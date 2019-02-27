# dts-generator-optimizer
Integrates with gulp to optimizes typescript declaration files generated with [dts-generator](https://github.com/SitePen/dts-generator).

## What it does
- Remove `private` class members declarations;
- Remove all internal `export` statements;
- Parses all dynamic `import()` statements, removes inline imports, and injects external import paths to the top of the file;
- Parses all external `import` statements, removes duplicates among them, and injects the result in alphabetical order at the top of the file;
- Removes `/// <references />` directives;
- Compresses all `declare module 'internal/path/in/project' {...}` statements inside a single `declare module ${moduleName} {...}` statement;
- Exports the declarations as a commonjs, AMD, and UMD modules so it can be imported everywhere;
- Remove unecessary blanklines;

## Installation
```bash
npm i -D dts-generator-optimizer
```
## Usage
Simple gulp configuration example.
```js
const dtsGenerator = require('dts-generator');
const optimizeDeclarations = require('dts-generator-optimizer');

gulp.task('declarations', (done) => {
    runSequence('declarations:generate', 'declarations:optimize', done);
});

gulp.task('declarations:generate', () =>
    dtsGenerator.default({
        project: './',
        out: 'dist/my-project.d.ts',
        exclude: ['node_modules/**/*.d.ts', 'types/**/*.d.ts'],
    });
);

gulp.task('declarations:optimize', () =>
    gulp.src('dist/my-project.d.ts')
        .pipe(optimizeDeclarations({
            moduleName: 'ReactVapor',
            internalImportPaths: ['src/', 'docs/'],
        }))
        .pipe(gulp.dest('dist'));
);
```

## Options
- `moduleName: string`: The name of the module to export.
- `internalImportPaths: RegExp[]`: The import paths internal to your projects that will be parsed out and combined in a single module.