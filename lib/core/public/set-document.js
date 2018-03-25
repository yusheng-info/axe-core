/**
 * Set what object axe-core should use as the document
 * @param	{Document}	document
 */
axe.setDocument = function setDocument (doc) {
	document = doc;
}

/**
 * Reset the document object to axe-core's default
 * @return	{Document}	document
 */
axe.resetDocument = function resetDocument () {
	return document = global.document;
}
