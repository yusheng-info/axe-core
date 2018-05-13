const done = this.async();
/**
	TODO: This method should be integrated in runRules() so that
	we can work with a cache of it inside of checks. As it stands now
	this is making fetch requests for every matching element.
	I'm thinking we should use something like ACT Rules format test aspect,
	where you define what 'aspect' you need to run (of which a complete 
	CSSOM would be one), and axe-core can than, based on what rules are
	enabled decide what requests need to be made. 
*/
axe.utils.loadStyleSheets()
	.then(sheets => {
		// TODO: We need utility functions to work with CSSOM. This code
		// has so much going on its hard to tell what it is doing

		// TODO: This check should be made to work on page container elements too
		// not just body / html, including containers that have its rotation
		// set inside a shadow DOM tree. 

		// Only use rules from the same document
		const { rules } = sheets.find(({ owner }) => owner === node.ownerDocument)

		// Find media queries with orientation: landscape
		const landscapeRules = rules.filter(rule => {
			return !!rule.media && Array.from(rule.media)
				.some(mediaquery => /orientation:\s+landscape/i.test(mediaquery));
		});

		// Find any rule in the landscape media with a transform property
		const landscapeTransformRule = landscapeRules.reduce((outRules, { cssRules, rules }) => {
			return outRules.concat(Array.from(cssRules || rules)
				.filter(rule => !!rule.style.transform));
		}, []);

		// Filter transforms that only have a 90% or 270% angle
		const orientationLockRules = landscapeTransformRule.filter(rule => {
			const rotate = rule.style.transform.match(/rotate\(([^)]+)deg\)/);
			const deg = parseInt(rotate && rotate[1] || 0);
			return deg % 90 === 0 && deg % 180 !== 0;
		});

		// TODO: This CSSOM filtering shouldn't happen for each element
		// instead, it would be much better if this could run only once. Maybe
		// we can even 

		// Figure out how many of these orientation lock rules match the node
		const matchingLockRules = orientationLockRules.filter(({ selectorText }) => {
			return node.matches(selectorText);
		});

		// TODO: Sort by priority and take the highest, instead of checking if
		// any of them applies
		done(matchingLockRules.length !== 0);
	});
