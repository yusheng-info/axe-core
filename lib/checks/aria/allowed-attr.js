options = options || {};

const invalid = [];
const attrs = [];

var attr, attrName, allowed,
	role = node.getAttribute('role'),
	attrNodes = node.attributes;

if (!role) {
	role = axe.commons.aria.implicitRole(node);
}

allowed = axe.commons.aria.allowedAttr(role);

if (Array.isArray(options[role])) {
	allowed = axe.utils.uniqueArray(options[role].concat(allowed));
}

if (role && allowed) {
	for (var i = 0, l = attrNodes.length; i < l; i++) {
		attr = attrNodes[i];
		attrName = attr.name;
		if (axe.commons.aria.validateAttr(attrName) && !allowed.includes(attrName)) {
			invalid.push(attrName + '="' + attr.nodeValue + '"');
			attrs.push(attrName)
		}
	}
}

if (invalid.length) {
	this.data({ attrs, invalid });
	return false;
}

return true;
