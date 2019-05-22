/* global dom */

dom.visuallySort = function(a, b) {
	for (let i = 0; i < a.stackingContext.length; i++) {
		if (typeof b.stackingContext[i] === 'undefined') {
			return -1;
		}

		if (a.stackingContext[i] === b.stackingContext[i]) {
			continue;
		}

		if (b.stackingContext[i] > a.stackingContext[i]) {
			return 1;
		} else {
			return -1;
		}
	}

	// same stack, return the later node
	return -1;
};
