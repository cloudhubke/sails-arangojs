const SqlString = require('./SqlString');
const filterStatement = require('./filterStatement');
const validateDocument = require('./validateDocument');

const modules = `const dbmodules = {
    SqlString: ${SqlString},
    filterStatement: ${filterStatement},
    validateDocument: ${validateDocument},
};`;

module.exports = `${modules}`;
