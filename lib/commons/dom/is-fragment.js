/* global dom */

/**
 * Test if node is a document fragement, or if it is attached to the DOM 
 * @param {Node} elm
 * @returns {Boolean}
 */
dom.isFragment = function (elm) {
	elm = elm.actualNode || elm;
	return elm.ownerDocument.documentElement.contains(elm);
}
