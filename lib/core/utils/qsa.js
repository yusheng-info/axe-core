// The lines below is because the latedef option does not work
var convertExpressions = function() {};

// todo: implement an option to follow aria-owns

function matchesTag(node, exp) {
	return (
		node.nodeType === 1 &&
		(exp.tag === '*' || node.nodeName.toLowerCase() === exp.tag)
	);
}

function matchesClasses(node, exp) {
	return (
		!exp.classes ||
		exp.classes.reduce((result, cl) => {
			return result && (node.className && node.className.match(cl.regexp));
		}, true)
	);
}

function matchesAttributes(node, exp) {
	return (
		!exp.attributes ||
		exp.attributes.reduce((result, att) => {
			var nodeAtt = node.getAttribute(att.key);
			return result && nodeAtt !== null && (!att.value || att.test(nodeAtt));
		}, true)
	);
}

function matchesId(node, exp) {
	return !exp.id || node.id === exp.id;
}

function matchesPseudos(target, exp) {
	if (
		!exp.pseudos ||
		exp.pseudos.reduce((result, pseudo) => {
			if (pseudo.name === 'not') {
				return result && !matchesSelector(target, pseudo.expressions[0][0]);
			}
			throw new Error(
				'the pseudo selector ' + pseudo.name + ' has not yet been implemented'
			);
		}, true)
	) {
		return true;
	}
	return false;
}

var escapeRegExp = (function() {
	/*! Credit: XRegExp 0.6.1 (c) 2007-2008 Steven Levithan <http://stevenlevithan.com/regex/xregexp/> MIT License */
	var from = /(?=[\-\[\]{}()*+?.\\\^$|,#\s])/g;
	var to = '\\';
	return function(string) {
		return string.replace(from, to);
	};
})();

var reUnescape = /\\/g;

function convertAttributes(atts) {
	/*! Credit Mootools Copyright Mootools, MIT License */
	if (!atts) {
		return;
	}
	return atts.map(att => {
		var attributeKey = att.name.replace(reUnescape, '');
		var attributeValue = (att.value || '').replace(reUnescape, '');
		var test, regexp;

		switch (att.operator) {
			case '^=':
				regexp = new RegExp('^' + escapeRegExp(attributeValue));
				break;
			case '$=':
				regexp = new RegExp(escapeRegExp(attributeValue) + '$');
				break;
			case '~=':
				regexp = new RegExp(
					'(^|\\s)' + escapeRegExp(attributeValue) + '(\\s|$)'
				);
				break;
			case '|=':
				regexp = new RegExp('^' + escapeRegExp(attributeValue) + '(-|$)');
				break;
			case '=':
				test = function(value) {
					return attributeValue === value;
				};
				break;
			case '*=':
				test = function(value) {
					return value && value.includes(attributeValue);
				};
				break;
			case '!=':
				test = function(value) {
					return attributeValue !== value;
				};
				break;
			default:
				test = function(value) {
					return !!value;
				};
		}

		if (attributeValue === '' && /^[*$^]=$/.test(att.operator)) {
			test = function() {
				return false;
			};
		}

		if (!test) {
			test = function(value) {
				return value && regexp.test(value);
			};
		}
		return {
			key: attributeKey,
			value: attributeValue,
			test: test
		};
	});
}

function convertClasses(classes) {
	if (!classes) {
		return;
	}
	return classes.map(className => {
		className = className.replace(reUnescape, '');

		return {
			value: className,
			regexp: new RegExp('(^|\\s)' + escapeRegExp(className) + '(\\s|$)')
		};
	});
}

function convertPseudos(pseudos) {
	if (!pseudos) {
		return;
	}
	return pseudos.map(p => {
		var expressions;

		if (p.name === 'not') {
			expressions = p.value;
			expressions = expressions.selectors
				? expressions.selectors
				: [expressions];
			expressions = convertExpressions(expressions);
		}
		return {
			name: p.name,
			expressions: expressions,
			value: p.value
		};
	});
}

/**
 * convert the css-selector-parser format into the Slick format
 * @private
 * @param Array {Object} expressions
 * @return Array {Object}
 *
 */
convertExpressions = function(expressions) {
	return expressions.map(exp => {
		var newExp = [];
		var rule = exp.rule;
		while (rule) {
			/* eslint no-restricted-syntax: 0 */
			// `.tagName` is a property coming from the `CSSSelectorParser` library
			newExp.push({
				tag: rule.tagName ? rule.tagName.toLowerCase() : '*',
				combinator: rule.nestingOperator ? rule.nestingOperator : ' ',
				id: rule.id,
				attributes: convertAttributes(rule.attrs),
				classes: convertClasses(rule.classNames),
				pseudos: convertPseudos(rule.pseudos)
			});
			rule = rule.rule;
		}
		return newExp;
	});
};

function matchesSelector(node, exp) {
	return (
		matchesTag(node.actualNode, exp) &&
		matchesClasses(node.actualNode, exp) &&
		matchesAttributes(node.actualNode, exp) &&
		matchesId(node.actualNode, exp) &&
		matchesPseudos(node, exp)
	);
}

/**
 * querySelectorAll implementation that operates on the flattened tree (supports shadow DOM)
 * @method querySelectorAll
 * @memberof axe.utils
 * @param	{NodeList} domTree flattened tree collection to search
 * @param	{String} selector String containing one or more CSS selectors separated by commas
 * @return {NodeList} Elements matched by any of the selectors
 */
axe.utils.querySelectorAll = function(domTree, selector) {
	return axe.utils.querySelectorAllFilter(domTree, selector);
};

/**
 * querySelectorAllFilter implements querySelectorAll on the virtual DOM with
 * ability to filter the returned nodes using an optional supplied filter function
 *
 * @method querySelectorAllFilter
 * @memberof axe.utils
 * @param	{NodeList} domTree flattened tree collection to search
 * @param	{String} selector String containing one or more CSS selectors separated by commas
 * @param	{Function} filter function (optional)
 * @return {Array} Elements matched by any of the selectors and filtered by the filter function
 */

axe.utils.querySelectorAllFilter = function(domTree, selector, filter) {
	domTree = Array.isArray(domTree) ? domTree : [domTree];
	var expressions = axe.utils.cssParser.parse(selector);
	expressions = expressions.selectors ? expressions.selectors : [expressions];
	expressions = convertExpressions(expressions);

	const matchedNodes = [];
	const selectorMap = domTree[0].selectorMap;

	// instead of looking at the entire tree, we can just look up in the
	// cache all the nodes with the tag or attributes and then filter by
	// the selector (so instead of looking at 55K elements, we look at only
	// 9K to start, and don't even have to look at their children)
	expressions.forEach(expression => {
		// if (window.performance && window.performance.mark) {
		// 	window.performance.mark('qsa-start-' + selector);
		// }

		// start at the last selector and work our way backwards
		const exp = expression[expression.length - 1];
		const tagName = exp.tag.toUpperCase();
		const id = exp.id;
		const isGlobalSelector =
			tagName === '*' && !exp.attributes && !exp.id && !exp.classes;
		let nodes;

		if (isGlobalSelector) {
			nodes = selectorMap['*'];
		}
		// check tags
		else if (tagName !== '*' && selectorMap[tagName]) {
			nodes = selectorMap[tagName];
		}
		// check id
		else if (id) {
			nodes = selectorMap.id;
		}
		// check class
		else if (exp.classes) {
			nodes = selectorMap.class;
		}
		// check attribute
		else if (exp.attributes) {
			// find the first attribute we have
			for (let j = 0; j < exp.attributes.length; j++) {
				let attrName = exp.attributes[j].key;

				if (selectorMap[attrName]) {
					nodes = selectorMap[attrName];
					break;
				}
			}
		}

		if (!nodes) {
			return;
		}

		if (!isGlobalSelector) {
			// filter by matching selector (global selector doesn't need to)
			nodes = nodes.filter(node => matchesSelector(node, exp));
		}

		// descendant selector
		if (expression.length > 1) {
			let combinator = exp.combinator;

			nodes = nodes.filter(node => {
				let currNode = node;
				let parentSelectors = expression.slice(0, expression.length - 1);
				let result;

				while (parentSelectors.length) {
					let parentExp = parentSelectors.pop();

					// direct parent
					if (combinator === '>') {
						result = matchesSelector(currNode.parent, parentExp);
					}
					// any parent
					else if (combinator === ' ') {
						while (currNode.parent) {
							result = matchesSelector(currNode.parent, parentExp);

							if (result) {
								break;
							} else {
								currNode = currNode.parent;
							}
						}
					} else {
						throw new Error(
							'axe.utils.querySelectorAll does not support the combinator: ' +
								combinator
						);
					}

					if (result) {
						currNode = currNode.parent;
						combinator = parentExp.combinator;
					} else {
						return false;
					}
				}

				return result;
			});
		}

		if (filter) {
			nodes = nodes.filter(node => filter(node));
		}

		// unique set
		nodes.forEach(node => {
			if (!matchedNodes.includes(node)) {
				matchedNodes.push(node);
			}
		});
	});

	// sort by DOM order
	matchedNodes.sort((a, b) => a.order - b.order);

	return matchedNodes;
};
