const through = require('through2');

const externalImports = [];

const BLANKLINES = /^\s*[\r\n]/gm;
const IMPORTS = /import\s+(.+from\s+)?'(.+).*';/gm;
const REFERENCES = /\s*\/\/\/\s+<reference\s+.*\/>/gm;
const INNER_MODULE_DECLARATION = /}\ndeclare\smodule\s+.*{\n/g;
const OUTER_MODULE_DECLARATION = /^declare\smodule\s+.*{$/gm;
const PRIVATES = /private .+;$/gm;
const EXPORTS = /export (?:default )?(.*)$/gm;

/**
 * @param {Object} config - The configuration options
 * @param {string} [config.moduleName = ''] - The name of the module to export
 * @param {RegExp[]} [config.internalImportPaths = []] - The internal import paths that will be parsed out
 */
module.exports = function (config) {
    return through.obj(function (vinylFile, encoding, callback) {
        const transformedFile = vinylFile.clone();

        const content = transformedFile.contents.toString(encoding)
            .replace(PRIVATES, '')
            .replace(EXPORTS, '$1')
            .replace(IMPORTS, (...regExpArgs) => parseImportStatement(regExpArgs, config))
            .replace(REFERENCES, '')
            .replace(BLANKLINES, '')
            .replace(INNER_MODULE_DECLARATION, '')
            .replace(OUTER_MODULE_DECLARATION, getOuterModuleDeclaration(config))
            .replace(BLANKLINES, '');

        transformedFile.contents = Buffer.from(
            getExternalImports()
            + '\n' +
            getExportDirectives(config)
            + '\n' +
            content,
            encoding
        );

        callback(null, transformedFile);
    });
}

function parseImportStatement(regExpArgs, config) {
    const [statement, _, path] = regExpArgs;

    if (!isInternalImport(path, config)) {
        handleExternalImport(statement);
    }

    return '';
}

function isInternalImport(path, {internalImportPaths = []}) {
    let isInternalPath = false;

    for (let internalPath of internalImportPaths) {
        const re = new RegExp(internalPath);
        if (path.match(re)) {
            isInternalPath = true;
            break;
        }
    };

    return isInternalPath;
}

function handleExternalImport(statement) {
    if (externalImports.indexOf(statement) < 0) {
        externalImports.push(statement);
    }
}

function getExternalImports() {
    return externalImports.sort().join('\n') + '\n';
}

function getExportDirectives({moduleName = ''}) {
    return `export = ${moduleName};\nexport as namespace ${moduleName};\n`
}

function getOuterModuleDeclaration({moduleName = ''}) {
    return `declare module ${moduleName} {`;
}
