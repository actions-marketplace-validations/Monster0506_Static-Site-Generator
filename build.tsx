import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import tailwindPlugin from "bun-plugin-tailwind";
import {join} from "path";
import {unlink} from "fs/promises";
import {read} from "./src/lib/load-file";
import {write} from "./src/lib/write-file";
import {markdownToHtml} from "./src/lib/markdown-convert";
import {parseTOML, stripFrontmatter} from "./src/lib/parse-frontmatter";

const basePath = process.env.BASE_PATH ?? "";

type SlotProps = {basePath: string};
type SlotComponent = (props: SlotProps) => React.ReactNode;

interface SiteConfig {
    Header?: SlotComponent,
    Footer?: SlotComponent,
    HeadExtra?: SlotComponent,
}

interface ResolvedSlots {
    Header: SlotComponent,
    Footer?: SlotComponent,
    HeadExtra?: SlotComponent,
}

function DefaultHeader({basePath}: SlotProps) {
    return <a href={`${basePath}/`} className="site-wordmark">Home</a>;
}

function siteConfigPath(): string {
    const root = process.env.GITHUB_WORKSPACE ?? process.cwd();
    return join(root, "_site.config.tsx");
}

async function loadSiteConfig(configPath: string): Promise<SiteConfig> {
    if (!(await Bun.file(configPath).exists())) return {};

    const mod = await import(configPath);
    return {
        Header: mod.Header,
        Footer: mod.Footer,
        HeadExtra: mod.HeadExtra,
    };
}

interface LayoutProps {
    title: string,
    description: string,
    children: React.ReactNode,
    slots: ResolvedSlots,
}

function PageLayout({title, description, children, slots}: LayoutProps) {
    const {Header, Footer, HeadExtra} = slots;
    return (
    <html lang="en">
        <head>
            <meta charSet="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>{title}</title>
            <meta name="description" content={description} />
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
            <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&display=swap" rel="stylesheet" />
            <link rel="stylesheet" href={`${basePath}/blog.css`} />
            {HeadExtra && <HeadExtra basePath={basePath} />}
        </head>
        <body>
            <div className="site-shell">
                <header className="site-header">
                    <Header basePath={basePath} />
                </header>
            {children}
            {Footer && (
                <footer className="site-footer">
                    <Footer basePath={basePath} />
                </footer>
            )}
            </div>
        </body>
    </html>
    );
}


function render(content: string, title: string, date: Date | null, hash: number): React.ReactNode {
    return (
    <article>
            <h1 className="post-title">{title}</h1>
            <p className="post-meta">
                #{hash}
                {date && (
                    <>
                        {" · "}
                        <time dateTime={date.toISOString()}>
                            {date.toLocaleDateString("en-US", {year: "numeric", month: "long", day: "numeric", timeZone: "UTC"})}
                        </time>
                    </>
                )}
            </p>
            <div className="post-body">{markdownToHtml(content)}</div>
          </article>
    )

}

function parseDate(value: unknown): Date | null {
    if (typeof value === "number") {
        return isNaN(value) ? null : new Date(value * 1000);
    }
    if (typeof value !== "string") return null;
    const time = Date.parse(value);
    if (isNaN(time)) return null;
    return new Date(time);
}


function generateHash(c: string): number {
    let hash = 0;
    for (const char of c){
        hash = (hash << 5) - hash + char.charCodeAt(0);
        hash |= 0;
    }
    return hash >>> 0;
}

async function buildCss(distDir: string, configPath: string) {
    let css = await Bun.file("./src/blog.css").text();
    if (await Bun.file(configPath).exists()) {
        css += `\n@source "${configPath.replace(/\\/g, "/")}";\n`;
    }

    const entry = join(import.meta.dir, "src", `.blog-tailwind-entry-${Date.now()}.css`);
    await Bun.write(entry, css);

    try {
        const result = await Bun.build({
            entrypoints: [entry],
            outdir: distDir,
            naming: "blog.css",
            plugins: [tailwindPlugin],
        });

        if (!result.success) {
            for (const log of result.logs) console.error(log);
            throw new Error("CSS build failed");
        }
    } finally {
        await unlink(entry).catch(() => {});
    }
}


async function buildIndex(items, distDir: string, slots: ResolvedSlots){

            let htmlContent=(<ul>
                {items.map(({title, hash, date}, index) => (
                    <li key={index}>
                        <a href={`${basePath}/${hash}.html`}>{title}</a>
                        {date && (
                            <>
                                <span> - </span>
                                <span>{date.toLocaleDateString("en-US", {year: "numeric", month: "long", day: "numeric", timeZone: "UTC"})}</span>
                            </>
                        )}
                    </li>
                ))}
            </ul>
            )
            const staticHtml = renderToStaticMarkup(<PageLayout title="Home" description="Home" slots={slots}>{htmlContent}</PageLayout>);


    write("index.html", staticHtml, distDir);
}


async function build() {
    const pagesDir = process.env.PAGES_DIR ?? "./_pages/";
    const distDir = process.env.DIST_DIR ?? "./dist/";

    try {
        const configPath = siteConfigPath();
        await buildCss(distDir, configPath);

        const siteConfig = await loadSiteConfig(configPath);
        const slots: ResolvedSlots = {
            Header: siteConfig.Header ?? DefaultHeader,
            Footer: siteConfig.Footer,
            HeadExtra: siteConfig.HeadExtra,
        };

        const glob = new Bun.Glob("*.md");
        const files = [...glob.scanSync({cwd: pagesDir})];
        let names = [];

        for (const file of files) {
            const shortName = file.replace(/\.md$/,"");
            const hash = generateHash(shortName);
            const content = await read(file, pagesDir);
            const frontmatter = parseTOML(content);
            const body = stripFrontmatter(content);
            const date = parseDate(frontmatter.date);
            const title= frontmatter.title?? "Untitled";
            const htmlContent = render(body, title, date, hash);
            const staticHtml = renderToStaticMarkup(<PageLayout title={title} description={frontmatter.description??""} slots={slots}>{htmlContent}</PageLayout>);

            write(hash+".html", staticHtml, distDir);
            const sortTime = date ? date.getTime() : Bun.file(join(pagesDir, file)).lastModified;
            names.push({title, hash, date, sortTime});
        }
        names.sort((a, b) => b.sortTime - a.sortTime);
        console.log(names);
        buildIndex(names, distDir, slots);
    }
    catch (error) {
        console.error(error);
        process.exit(1);
    }

}



build()








