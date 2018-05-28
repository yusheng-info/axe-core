// Indicate that `role` is the tested attribute
this.data({ attrs: ['role'] });

return axe.commons.aria.getRoleType(node.getAttribute('role')) === 'abstract';
