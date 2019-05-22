/*eslint no-use-before-define: 0*/
var axe = axe || { utils: {} };

function isStackingContext(vNode) {
	//Also see: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Positioning/Understanding_z_index/The_stacking_context
	let node = vNode.actualNode;

	//the root element (HTML)
	if (
		!node ||
		node.nodeName === 'HTML' ||
		node.nodeName === '#document-fragment'
	) {
		return true;
	}

	var computedStyle = vNode.computedStyle;

	// position: fixed or sticky
	if (
		computedStyle.position === 'fixed' ||
		computedStyle.position === 'sticky'
	) {
		return true;
	}

	// positioned (absolutely or relatively) with a z-index value other than "auto",
	if (computedStyle.zIndex !== 'auto' && computedStyle.position !== 'static') {
		return true;
	}

	// elements with an opacity value less than 1.
	if (computedStyle.opacity !== '1') {
		return true;
	}

	// elements with a transform value other than "none"
	if (computedStyle.transform !== 'none') {
		return true;
	}

	// elements with a mix-blend-mode value other than "normal"
	if (computedStyle.mixBlendMode !== 'normal') {
		return true;
	}

	// elements with a filter value other than "none"
	if (computedStyle.filter !== 'none') {
		return true;
	}

	// elements with a perspective value other than "none"
	if (computedStyle.perspective !== 'none') {
		return true;
	}

	// elements with isolation set to "isolate"
	if (computedStyle.isolation === 'isolate') {
		return true;
	}

	// transform or opacity in will-change even if you don't specify values for these attributes directly
	if (
		computedStyle.willChange === 'transform' ||
		computedStyle.willChange === 'opacity'
	) {
		return true;
	}

	// elements with -webkit-overflow-scrolling set to "touch"
	if (computedStyle.webkitOverflowScrolling === 'touch') {
		return true;
	}

	// a flex item with a z-index value other than "auto", that is the parent element display: flex|inline-flex,
	if (computedStyle.zIndex !== 'auto') {
		var parentStyle = getComputedStyle(node.parentNode);
		if (
			parentStyle.display === 'flex' ||
			parentStyle.display === 'inline-flex'
		) {
			return true;
		}
	}

	return false;
}

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
function virtualDOMfromNode(node, parent, shadowId) {
	const vNodeCache = {};
	const vNode = {
		shadowId: shadowId,
		children: [],
		clientRects: [],
		actualNode: node,
		_isHidden: null, // will be populated by axe.utils.isHidden
		get isFocusable() {
			if (!vNodeCache.hasOwnProperty('_isFocusable')) {
				vNodeCache._isFocusable = axe.commons.dom.isFocusable(node);
			}
			return vNodeCache._isFocusable;
		},
		get tabbableElements() {
			if (!vNodeCache.hasOwnProperty('_tabbableElements')) {
				vNodeCache._tabbableElements = axe.commons.dom.getTabbableElements(
					this
				);
			}
			return vNodeCache._tabbableElements;
		}
	};
	axe._cache.get('nodeMap').set(node, vNode);

	if (
		typeof node.getClientRects === 'function' &&
		typeof node.getBoundingClientRect === 'function'
	) {
		if (!axe._cache.get('quadtree')) {
			axe._cache.set('quadtree', new axe.utils.Quadtree({ maxDepth: 10 }));
		}

		// add all elements to the quadtree and cache their position
		const quadtree = axe._cache.get('quadtree');
		const clientRects = Array.from(node.getClientRects()).filter(
			rect => rect.width && rect.width > 0
		);

		// cache bounding rects
		let rect = node.getBoundingClientRect();
		vNode.x = rect.x;
		vNode.y = rect.y;
		vNode.width = rect.width;
		vNode.height = rect.height;
		vNode.clientRects = clientRects;

		quadtree.add(vNode);
	}

	if (node.nodeType === 1) {
		vNode.computedStyle = window.getComputedStyle(node);
		vNode.stackingContext = parent ? parent.stackingContext.slice() : [0];

		if (vNode.computedStyle.zIndex !== 'auto') {
			vNode.stackingContext[vNode.stackingContext.length - 1] = parseInt(
				vNode.computedStyle.zIndex
			);
		}
		if (isStackingContext(vNode)) {
			vNode.stackingContext.push(0);
		}
	}

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
function flattenTree(node, shadowId, parent) {
	// using a closure here and therefore cannot easily refactor toreduce the statements
	var retVal, realArray, nodeName;
	function reduceShadowDOM(res, child, parent) {
		var replacements = flattenTree(child, shadowId, parent, true);
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

				return [retVal];
			} else if (node.nodeType === 3) {
				// text
				return [virtualDOMfromNode(node, parent)];
			}
			return undefined;
		}
	}
}

/**
 * Recursvely returns an array of the virtual DOM nodes at this level
 * excluding comment nodes and the shadow DOM nodes <content> and <slot>
 *
 * @param {Node} node the current node
 * @param {String} shadowId, optional ID of the shadow DOM that is the closest shadow
 *                           ancestor of the node
 */
axe.utils.getFlattenedTree = function(node, shadowId) {
	axe._cache.set('nodeMap', new WeakMap());
	return flattenTree(node, shadowId);
};

/**
 * Return a single node from the virtual dom tree
 *
 * @param {Object} vNode The flattened, virtual DOM tree
 * @param {Node}   node  The HTML DOM node
 */
axe.utils.getNodeFromTree = function(vNode, node) {
	const el = node || vNode;
	return axe._cache.get('nodeMap') ? axe._cache.get('nodeMap').get(el) : null;
};
