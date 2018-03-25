function mockFrameSelectOnce () {
	'use strict';
	var __select = axe.utils.select
	axe.utils.select = function (query) {
		assert.equal(query, 'frame, iframe', 'Expect mock select to be called once');
		axe.utils.select = __select;
		return []
	}
}


describe('axe.setDocument', function () {
	'use strict';
	
	it('sets the object axe uses as the document object', function () {
		if (window.PHANTOMJS) {
			assert.ok('PhantomJS is a liar');
			return;
		}

		assert.equal((new axe.Context()).include[0].actualNode, document.documentElement);
		var doc = document.implementation.createHTMLDocument('Document all of the things');
		mockFrameSelectOnce();

		axe.setDocument(doc);
		assert.equal((new axe.Context()).include[0].actualNode, doc.documentElement);
	});
});

describe('axe.resetDocument', function () {
	'use strict';
	it('restores the object axe uses as the document from global.document', function () {
		if (window.PHANTOMJS) {
			assert.ok('PhantomJS is a liar');
			return;
		}

		var doc = document.implementation.createHTMLDocument('Document all of the things');
		mockFrameSelectOnce();

		axe.setDocument(doc);
		assert.equal((new axe.Context()).include[0].actualNode, doc.documentElement);

		var out = axe.resetDocument();
		assert.equal(out, document);
		assert.equal((new axe.Context()).include[0].actualNode, document.documentElement);
	});
});