const fs = require('fs');
const marked = require('marked');
const markedMangle = require('marked-mangle');
const markedGfmHeadingId = require('marked-gfm-heading-id');
const path = require('path');
const prettier = require('prettier');
const liveServer = require('live-server');
const chokidar = require('chokidar');

const srcDir = path.resolve('src');
const distDir = path.resolve('dist');
const srcAssetsDir = path.resolve('assets');
const distAssetsDir = path.join(distDir, 'assets');

// 在所有之前，判断 dist 是否存在
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);

// 清空 dist
deleteFilesInDirectory(distDir);

module.exports = {

    build: async function () {

        await buildNovel();
        await buildIndex();

        await copyDirectory(srcAssetsDir, distAssetsDir);

        console.log('Build complete');

    },

    dev: async function () {

        await buildNovel();
        await buildIndex();

        liveServer.start({
            root: distDir,
            mount: [['/assets', srcAssetsDir]]
        });

        const watcher = chokidar.watch(`${srcDir}/*.md`);

        watcher.on('add', (filePath) => mdUpdate(filePath, 'update'));
        watcher.on('change', (filePath) => mdUpdate(filePath, 'update'));
        watcher.on('unlink', (filePath) => mdUpdate(filePath, 'remove'));

    }

}


/**
 * 构建小说
 */
async function buildNovel() {

    const mdFileList = fs.readdirSync(srcDir).filter(file => path.extname(file).toLowerCase() === '.md' && fs.statSync(path.join(srcDir, file)).isFile());

    console.log(mdFileList);

    for (let index in mdFileList) {

        const mdFile = mdFileList[index];

        console.log('Building', mdFile);

        const md = fs.readFileSync(path.join(srcDir, mdFile), { encoding: 'utf-8' });

        const title = path.basename(mdFile, path.extname(mdFile));

        const html = await prettier.format(await md2html(md, title), { parser: 'html' });

        fs.writeFileSync(path.join(distDir, title + '.html'), html);

        console.log('Build complete', mdFile);

    }

}

/**
 * 构建索引
 */
async function buildIndex() {

    console.log('Building index');

    const indexList = fs.readdirSync(distDir).filter(file => fs.statSync(path.join(distDir, file)).isFile()).map(file => path.basename(file, path.extname(file))).filter(file => file.toLowerCase() != 'index');

    let body = '';

    indexList.forEach(index => {

        body += `<a href="${index}.html" class="item">${index}</a>`

    })

    let out = fs.readFileSync(path.resolve('template/index.html'), { encoding: 'utf-8' });

    out = out.replace(/\{\{body\}\}/g, body);

    out = await prettier.format(out, { parser: 'html' });

    fs.writeFileSync(path.resolve(distDir, 'index.html'), out);

}

/**
 * md 转 html
 * @param {string} md 
 * @param {string} title 
 * @returns {string}
 */
async function md2html(md, title) {

    const body = await marked.parse(md, {
        mangle: markedMangle,
        headerIds: markedGfmHeadingId
    });

    let out = fs.readFileSync(path.resolve('template/novel.html'), { encoding: 'utf-8' });

    out = out.replace(/\{\{body\}\}/g, body);
    out = out.replace(/\{\{title\}\}/g, title);

    return out;

}

/**
 * watcher
 * @param {string} filePath 
 * @param {string} type 
 * @returns 
 */
async function mdUpdate(filePath, type) {

    const fileName = path.basename(filePath, path.extname(filePath));

    switch (type) {

        case 'update':

            const md = fs.readFileSync(filePath, 'utf8');

            const html = await prettier.format(await md2html(md, fileName), { parser: 'html' });

            fs.writeFileSync(path.join(distDir, fileName + '.html'), html);

            break;

        case 'remove':

            fs.unlinkSync(path.join(distDir, fileName + '.html'));

            break;

        default:
            return;
    }

    await buildIndex();

    console.log('Change detected', filePath);

}

/**
 * 清空目录
 * @param {string} directory 
 */
function deleteFilesInDirectory(directory) {

    const files = fs.readdirSync(directory);

    for (const file of files) {

        const filePath = path.join(directory, file);

        if (fs.statSync(filePath).isDirectory()) {

            deleteFilesInDirectory(filePath);

        } else {

            fs.unlinkSync(filePath);

        }
    }

    console.log(`Directory cleared`, directory);
}

/**
 * 复制目录
 * @param {string} sourceDir 
 * @param {string} targetDir 
 */
function copyDirectory(sourceDir, targetDir) {

    fs.mkdirSync(targetDir, { recursive: true });

    const files = fs.readdirSync(sourceDir);

    for (const file of files) {

        const sourceFilePath = path.join(sourceDir, file);
        const targetFilePath = path.join(targetDir, file);

        const stats = fs.statSync(sourceFilePath);

        if (stats.isFile()) {

            fs.copyFileSync(sourceFilePath, targetFilePath);

        } else if (stats.isDirectory()) {

            copyFolder(sourceFilePath, targetFilePath);

        }
    }
}