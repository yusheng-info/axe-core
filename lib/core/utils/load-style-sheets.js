
// A simple HTML document to append stylesheet to without actually
// applying styles to the existing page.
let tempDoc;

/**
 * Fetch a style sheet from a URL 
 * @param	url	string
 * @return CSSStyleSheet
 */
function fetchStyleSheet (url) {
	// TODO: This should probably be cached.

	// TODO: This should use XHR to support IE, just couldn't be bothered
	// given that I'm prototyping.
	return fetch(url)
		.then(sheet => sheet.text())
		.then((sheetText) => {
			if (!tempDoc) {
				tempDoc = document.implementation.createHTMLDocument('');
			}
			// TODO: I **think** this is the cheapest way to generate a stylesheet
			// object. 
			var style = tempDoc.createElement('style')
			style.innerHTML = sheetText;

			// Appending the style creates the sheet
			// TODO: Should we remove this after the sheet is created?
			tempDoc.head.appendChild(style);

			return style.sheet;
		});
}

/**
 * Get all stylesheets used in a document, even those on different domains
 */
function loadDocumentStyleSheets (doc, timeout = 200) {
	const sheets = Array.from(doc.styleSheets)
	const fetching = sheets.filter(sheet => !sheet.disabled)
		.map((sheet) => {
			try {
				// Return the sheet if accessing sheet.rules doesn't throw
				return sheet.cssRules && sheet
			} catch (e) {
				// Fetch existing sheets
				return fetchStyleSheet(sheet.href);
			}
		})

	// TODO: Not sure if this is the best way to handle timeout
	// but we need an easy way to do this. We should also make sure
	// that when this fails the rules that use CSSOM are set to incomplete.
	return Promise.race([
		Promise.all(fetching),
		new Promise(resolve => setTimeout(resolve, timeout))
	]);
}

function loadStyleSheets (treeRoot = axe._tree[0], timeout = 200) {
	const ids = [];

	// TODO: This looks for all unique ownerDocument props on the page.
	// There is probably a better way to do this though since getFlattenedTree
	// has all of them. Maybe we can index all the roots?
	const documents = axe.utils.querySelectorAllFilter(treeRoot, '*', function filter (node) {
		if (ids.includes(node.shadowId)) {
			return false;
		}
		ids.push(node.shadowId)
		return true;
	}).map(node => node.actualNode.ownerDocument);

	return Promise.all(documents.map(owner => {
		return loadDocumentStyleSheets(owner, timeout)
			.then(sheets => {
				const rules = sheets.reduce((rules, sheet) => {
					return rules.concat(Array.from(sheet.cssRules || sheet.rules));
				}, []);
				return { owner, rules };
			})
	}));
}

axe.utils.loadStyleSheets = loadStyleSheets;
