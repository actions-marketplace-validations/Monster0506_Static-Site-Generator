import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import tailwindPlugin from "bun-plugin-tailwind";
import {read} from "./src/lib/load-file";
import {write} from "./src/lib/write-file";
import {markdownToHtml} from "./src/lib/markdown-convert";
import {parseTOML, stripFrontmatter} from "./src/lib/parse-frontmatter";

const basePath = process.env.BASE_PATH ?? "";

interface LayoutProps {
    title: string,
    description: string,
    children: React.ReactNode
}

function PageLayout({title, description, children}: LayoutProps) {
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
        </head>
        <body>
            <div className="site-shell">
                <header className="site-header">
                    <a href={`${basePath}/`} className="site-wordmark">Home</a>
                </header>
            {children}
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

async function buildCss(distDir: string) {
    const result = await Bun.build({
        entrypoints: ["./src/blog.css"],
        outdir: distDir,
        naming: "[name].css",
        plugins: [tailwindPlugin],
    });

    if (!result.success) {
        for (const log of result.logs) console.error(log);
        throw new Error("CSS build failed");
    }
}


async function buildIndex(items){
            
            let htmlContent=(<ul>
                {items.map(({title, hash, date}, index) => (
                    <li key={index}>
                        <a href={`${basePath}/${hash}.html`}>{title}</a><span> - </span>
                        <span>{date.toLocaleDateString("en-US", {year: "numeric", month: "long", day: "numeric", timeZone: "UTC"})}</span>
                    </li>
                ))}
            </ul>
            )
            const staticHtml = renderToStaticMarkup(<PageLayout title="Home" description="Home">{htmlContent}</PageLayout>);
    

    write("index.html", staticHtml);
}


async function build() {
    const pagesDir = "./_pages/";
    const distDir = "./dist/";

    try {
        await buildCss(distDir);

        const glob = new Bun.Glob("*.md");
        const files = [...glob.scanSync({cwd: pagesDir})];
        let names = [];
        
        for (const file of files) {
            const shortName = file.replace(/\.md$/,"");
            const hash = generateHash(shortName);
            const content = await read(file);
            const frontmatter = parseTOML(content);
            const body = stripFrontmatter(content);
            const date = parseDate(frontmatter.date);
            const title= frontmatter.title?? "Untitled";
            const htmlContent = render(body, title, date, hash);
            const staticHtml = renderToStaticMarkup(<PageLayout title={title} description={frontmatter.description??""}>{htmlContent}</PageLayout>);

            write(hash+".html", staticHtml);
            names.push({title, hash, date});
        }
        console.log(names);
        buildIndex(names);
    }
    catch (error) {
        console.error(error)
    }
    
}



build()








