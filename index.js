const through = require('through2');

const externalImports = {};
const defaultImportObj = {
    members: [],
    path: '',
    global: '',
};

const BLANKLINES = /^\s*[\r\n]/gm;
const IMPORTS = /import\s+(.+from\s+)?'(.+).*';/gm;
const DYNAMIC_IMPORTS = /import\(['"]([\w./-]+)['"]\)\.(\w+)/g;
const REFERENCES = /\s*\/\/\/\s+<reference\s+.*\/>/gm;
const INNER_MODULE_DECLARATION = /}\ndeclare\smodule\s+.*{\n/g;
const OUTER_MODULE_DECLARATION = /^declare\smodule\s+.*{$/gm;
const PRIVATES = /private .+;$/gm;
const RELATIVE_PATH = /^\.?\.\/.+$/;
const DESTRUCTURE_IMPORT = /(?:(?:(\*\sas\s\w+)|{\s(.+)\s})\sfrom\s)?'([\w./@-]+)'/;

const Colors = {
    RESET: '\x1b[0m',
    RED: '\x1b[31m',
};

/**
 * @param {Object} config - The configuration options
 * @param {string} config.moduleName - The name of the module to export (should be the same as the package.json)
 * @param {string} [config.libraryName = ''] - The name of the exported UMD variable
 * @param {RegExp[]} [config.internalImportPaths = []] - The internal import paths that will be parsed out
 */
module.exports = config =>
    through.obj((vinylFile, encoding, callback) => {
        const transformedFile = vinylFile.clone();

        const content = transformedFile.contents
            .toString(encoding)
            .replace(PRIVATES, '')
            .replace(DYNAMIC_IMPORTS, (...regExpArgs) => parseDynamicImports(regExpArgs, config))
            .replace(IMPORTS, (...regExpArgs) => parseImportStatement(regExpArgs, config))
            .replace(REFERENCES, '')
            .replace(BLANKLINES, '')
            .replace(INNER_MODULE_DECLARATION, '')
            .replace(OUTER_MODULE_DECLARATION, getOuterModuleDeclaration(config))
            .replace(BLANKLINES, '');

        transformedFile.contents = Buffer.from(
            getExternalImports() + '\n' + getExportDirectives(config) + '\n' + content,
            encoding
        );

        callback(null, transformedFile);
    });

function parseDynamicImports(regExpArgs, config) {
    const [, importPath, importMember] = regExpArgs;

    if (!isInternalImport(importPath, config)) {
        handleExternalImport(formatImport(`{ ${importMember} }`, importPath));
    }

    return importMember;
}

function parseImportStatement(regExpArgs, config) {
    const [statement, _, path] = regExpArgs;

    if (!isInternalImport(path, config)) {
        handleExternalImport(statement);
    }

    return '';
}

function isInternalImport(path, {internalImportPaths = []}) {
    const matchers = [...internalImportPaths, RELATIVE_PATH];
    let isInternalPath = false;

    for (let matcher of matchers) {
        const expression = new RegExp(matcher);
        if (path.match(expression)) {
            isInternalPath = true;
            break;
        }
    }

    return isInternalPath;
}

function handleExternalImport(statement) {
    const matches = DESTRUCTURE_IMPORT.exec(statement);

    if (matches) {
        const [, globalImport, members, path] = matches;
        const importObj = Object.assign({}, defaultImportObj, externalImports[path]);

        importObj.path = importObj.path || path || '';
        importObj.global = importObj.global || globalImport || '';
        importObj.members = [...importObj.members];

        if (members && typeof members === 'string') {
            const memberCandidates = members.split(/,\s?/);
            memberCandidates.forEach(candidate => {
                if (importObj.members.indexOf(candidate) < 0) {
                    importObj.members.push(candidate);
                }
            });
        }

        externalImports[path] = importObj;
    } else {
        console.error(Colors.RED, `Unrecognized import path character in "${statement}"`, Colors.RESET);
    }
}

function getExternalImports() {
    return (
        Object.keys(externalImports)
            .reduce(formatImportObjToString, [])
            .sort()
            .join('\n') + '\n'
    );
}

function formatImportObjToString(memo, importPath) {
    const {global, members, path} = externalImports[importPath];

    if (!!global) {
        memo.push(formatImport(global, path));
    }

    if (members.length > 0) {
        memo.push(formatImport(`{ ${members.join(', ')} }`, path));
    }

    if (!global && members.length === 0) {
        memo.push(formatImport('', path));
    }

    return memo;
}

function formatImport(target, path) {
    const from = target ? ' from ' : '';
    return `import ${target}${from}'${path}';`;
}

function getExportDirectives({libraryName = ''}) {
    return libraryName ? `export as namespace ${libraryName};\n` : '';
}

function getOuterModuleDeclaration({moduleName}) {
    return `declare module "${moduleName}" {`;
}
