const role = node.getAttribute('role');
const roles = role ? role.split(/\s+/) : [];

// Indicate that `role` is the tested attribute
this.data({ attrs: ['role'] });

// Ignore everything after the first instead of falling back
if (!options.fallbackRole) {
	roles.splice(1);
}


const hasValidRole = roles.some(role => axe.commons.aria.isValidRole(role));
if (!hasValidRole && roles.some(role => role === '{axe-slotted-value}')) {
	return undefined;
}

return !hasValidRole;
