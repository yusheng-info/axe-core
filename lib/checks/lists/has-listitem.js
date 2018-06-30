return virtualNode.children.every(({ actualNode }) => {
	return !['LI', 'SLOT'].includes(actualNode.nodeName.toUpperCase())
});
