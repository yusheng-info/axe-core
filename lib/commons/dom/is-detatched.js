/* global dom */

/**
 * Test if node is a document fragement, or if it is attached to the DOM 
 * @param {Node} elm
 * @returns {Boolean}
 */
dom.isDetatched = function isDetatched (elm) {
	let root;
	elm = (elm.actualNode || elm)
	try {
		root = elm.getRootNode({ composed: true });
	} catch (e) {
		console.log('ERR!', e.message)
		return false;
	}
	return root.nodeType === 1;
}
