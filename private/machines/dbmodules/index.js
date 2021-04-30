const SqlString = require('./SqlString');
const filterStatement = require('./filterStatement');

const modules = `const dbmodules = {
    SqlString: ${SqlString},
    filterStatement: ${filterStatement},
};`;

module.exports = `${modules}`;
