/*eslint no-use-before-define: 0*/
var axe = axe || { utils: {} };

axe.utils.generateSelectorMap = function(node) {
	node.selectorMap = {};
	let el = node.actualNode;

	// don't add text nodes to the selector map
	if (el.nodeType !== 1) {
		return;
	}

	let nodeName = el.nodeName.toUpperCase();
	let attributes =
		el.hasAttributes && el.hasAttributes()
			? axe.utils.getNodeAttributes(el)
			: [];

	node.selectorMap['*'] = [node];
	node.selectorMap[nodeName] = [node];

	for (let i = 0; i < attributes.length; i++) {
		let attr = attributes[i];
		node.selectorMap[attr.name] = [node];
	}

	if (node.children) {
		node.children.forEach(axe.utils.generateSelectorMap);
	}

	if (node.parent) {
		Object.keys(node.selectorMap).forEach(key => {
			node.parent.selectorMap[key] = node.parent.selectorMap[key] || [];

			// faster than concat since we don't have to garbage collect the
			// old array
			node.selectorMap[key].forEach(n => {
				node.parent.selectorMap[key].push(n);
			});
		});
	}
};

/**
 * This implemnts the flatten-tree algorithm specified:
 * Originally here https://drafts.csswg.org/css-scoping/#flat-tree
 * Hopefully soon published here: https://www.w3.org/TR/css-scoping-1/#flat-tree
 *
 * Some notable information:
 ******* NOTE: as of Chrome 59, this is broken in Chrome so that tests fail completely
 ******* removed functionality for now
 * 1. <slot> elements do not have boxes by default (i.e. they do not get rendered and
 *    their CSS properties are ignored)
 * 2. <slot> elements can be made to have a box by overriding the display property
 *    which is 'contents' by default
 * 3. Even boxed <slot> elements do not show up in the accessibility tree until
 *    they have a tabindex applied to them OR they have a role applied to them AND
 *    they have a box (this is observed behavior in Safari on OS X, I cannot find
 *    the spec for this)
 */

/**
 * Wrap the real node and provide list of the flattened children
 *
 * @param node {Node} - the node in question
 * @param shadowId {String} - the ID of the shadow DOM to which this node belongs
 * @return {Object} - the wrapped node
 */
let order = 0;
function virtualDOMfromNode(node, parent, shadowId) {
	const vNodeCache = {};
	const vNode = {
		shadowId: shadowId,
		children: [],
		parent: parent,
		actualNode: node,
		order: order++,
		_isHidden: null, // will be populated by axe.utils.isHidden
		get isFocusable() {
			if (!vNodeCache._isFocusable) {
				vNodeCache._isFocusable = axe.commons.dom.isFocusable(node);
			}
			return vNodeCache._isFocusable;
		},
		get tabbableElements() {
			if (!vNodeCache._tabbableElements) {
				vNodeCache._tabbableElements = axe.commons.dom.getTabbableElements(
					this
				);
			}
			return vNodeCache._tabbableElements;
		}
	};
	axe._cache.nodeMap.set(node, vNode);
	return vNode;
}

/**
 * find all the fallback content for a <slot> and return these as an array
 * this array will also include any #text nodes
 *
 * @param node {Node} - the slot Node
 * @return Array{Nodes}
 */
function getSlotChildren(node) {
	var retVal = [];

	node = node.firstChild;
	while (node) {
		retVal.push(node);
		node = node.nextSibling;
	}
	return retVal;
}

/**
 * Recursvely returns an array of the virtual DOM nodes at this level
 * excluding comment nodes and the shadow DOM nodes <content> and <slot>
 *
 * @param {Node} node the current node
 * @param {String} shadowId, optional ID of the shadow DOM that is the closest shadow
 *                           ancestor of the node
 */
axe.utils.getFlattenedTree = function(node, shadowId, parent, recurssed) {
	if (!recurssed) {
		order = 0;
	}

	// using a closure here and therefore cannot easily refactor toreduce the statements
	var retVal, realArray, nodeName;
	function reduceShadowDOM(res, child, parent) {
		var replacements = axe.utils.getFlattenedTree(
			child,
			shadowId,
			parent,
			true
		);
		if (replacements) {
			res = res.concat(replacements);
		}
		return res;
	}

	if (node.documentElement) {
		// document
		node = node.documentElement;
	}
	nodeName = node.nodeName.toLowerCase();

	if (axe.utils.isShadowRoot(node)) {
		// generate an ID for this shadow root and overwrite the current
		// closure shadowId with this value so that it cascades down the tree
		retVal = virtualDOMfromNode(node, parent, shadowId);
		shadowId =
			'a' +
			Math.random()
				.toString()
				.substring(2);
		realArray = Array.from(node.shadowRoot.childNodes);
		retVal.children = realArray.reduce((res, child) => {
			return reduceShadowDOM(res, child, retVal);
		}, []);

		if (!recurssed) {
			axe.utils.generateSelectorMap(retVal);
		}

		return [retVal];
	} else {
		if (nodeName === 'content') {
			realArray = Array.from(node.getDistributedNodes());
			return realArray.reduce((res, child) => {
				return reduceShadowDOM(res, child, parent);
			}, []);
		} else if (
			nodeName === 'slot' &&
			typeof node.assignedNodes === 'function'
		) {
			realArray = Array.from(node.assignedNodes());
			if (!realArray.length) {
				// fallback content
				realArray = getSlotChildren(node);
			}
			var styl = window.getComputedStyle(node);
			// check the display property
			if (false && styl.display !== 'contents') {
				// intentionally commented out
				// has a box
				retVal = virtualDOMfromNode(node, parent, shadowId);
				retVal.children = realArray.reduce((res, child) => {
					return reduceShadowDOM(res, child, retVal);
				}, []);

				if (!recurssed) {
					axe.utils.generateSelectorMap(retVal);
				}

				return [retVal];
			} else {
				return realArray.reduce((res, child) => {
					return reduceShadowDOM(res, child, parent);
				}, []);
			}
		} else {
			if (node.nodeType === 1) {
				retVal = virtualDOMfromNode(node, parent, shadowId);
				realArray = Array.from(node.childNodes);
				retVal.children = realArray.reduce((res, child) => {
					return reduceShadowDOM(res, child, retVal);
				}, []);

				if (!recurssed) {
					axe.utils.generateSelectorMap(retVal);
				}

				return [retVal];
			} else if (node.nodeType === 3) {
				// text
				return [virtualDOMfromNode(node, parent)];
			}
			return undefined;
		}
	}
};

/**
 * Return a single node from the virtual dom tree
 *
 * @param {Object} vNode The flattened, virtual DOM tree
 * @param {Node}   node  The HTML DOM node
 */
axe.utils.getNodeFromTree = function(vNode, node) {
	const el = node || vNode;
	return axe._cache.nodeMap.get(el);
};
