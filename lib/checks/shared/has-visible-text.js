return axe.commons.text.accessibleArrayVirtual(virtualNode)
	.reduce((outcome, textFragement) => {
		if (outcome || textFragement.toString().trim().length > 0) {
			return true;
		} if (textFragement === axe.constants.slottedSegment) {
			return undefined;
		} else {
			return outcome;
		}
	}, false);
