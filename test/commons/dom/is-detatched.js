describe('is-detatched', function() {
	var fixture = document.getElementById('fixture');
	var isDetatched = axe.commons.dom.isDetatched;
	var shadowSupport = axe.testUtils.shadowSupport;
	var div;

	beforeEach(function() {
		div = document.createElement('div');
	});

	it('returns false for nodes in the DOM tree', function () {
		fixture.appendChild(div);
		assert.isFalse(isDetatched(div));
	});
	
	it('returns true for nodes not in the DOM tree', function () {
		assert.isTrue(isDetatched(div));
	});

	(shadowSupport.v1 ? it : xit)('returns false for nodes in the a shadow DOM tree', function() {
		fixture.innerHTML = '<div id="shadow"></div>';
		var shadow = document.getElementById('shadow').attachShadow({ mode: 'open' });
		shadow.appendChild(div);

		assert.isFalse(isDetatched(div));
	});

	(shadowSupport.v1 ? it : xit)('returns false for shadow nodes in the a shadow DOM tree', function() {
		fixture.innerHTML = '<div id="shadow"></div>';
		var shadow = document.getElementById('shadow').attachShadow({ mode: 'open' });
		var div = shadow.ownerDocument.createElement('div')
		shadow.appendChild(div);

		assert.isFalse(isDetatched(div));
	});

	(shadowSupport.v1 ? it : xit)('returns true for nodes in a shadow DOM tree on a detatched node', function() {
		fixture.innerHTML = '<div id="shadow"></div>';
		var div = document.createElement('div');
		var shadow = div.attachShadow({ mode: 'open' });
		var shadowDiv = shadow.ownerDocument.createElement('div')
		shadow.appendChild(shadowDiv);

		assert.isTrue(isDetatched(shadowDiv));
	});
});
