import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {read} from "./src/lib/load-file";
import {write} from "./src/lib/write-file";
import {markdownToHtml} from "./src/lib/markdown-convert";
import {parseTOML} from "./src/lib/parse-frontmatter";

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
        </head>
        <body className="bg-slate-50 text-slate-900 min-h-screen py-12 px-4">
            <main className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-slate-100">
                <nav className="mb-12 border-b border-slate-100 pb-4">
                    <a href="/" className="font-semibold text-indigo-600 hover:text-indigo-800">Blog</a>
                </nav>
            {children}
            </main>
        </body>
    </html>   
    );
} 


function render(content: string, title: string, date: Date): React.ReactNode {
    return (
    <article className="prose prose-slate lg:prose-lg max-w-none">
            <header className="mb-8">
              <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
                {title}
              </h1>
              {date && (
                <time className="text-sm text-slate-500 font-medium">
                  Published on {date}
                </time>
              )}
            </header>
            {markdownToHtml(content)}
          </article>
    )

}


function generateHash(c: string): number {
    let hash = 0;
    for (const char of c){
        hash = (hash << 5) - hash + char.charCodeAt(0);
        hash |= 0;
    }
    return hash;
}

async function build() {
    const pagesDir = "./_pages/";
    const distDir = "./dist/";
    
    try {
        const glob = new Bun.Glob("*.md");
        const files = [...glob.scanSync({cwd: pagesDir})];
        
        for (const file of files) {
            const shortName = file.replace(/\.md$/,"");
            const hash = generateHash(shortName);
            const content = await read(file);
            const frontmatter = parseTOML(content);
            const htmlContent = render(content, frontmatter.title?? "Untitled", Date.now());
            const staticHtml = renderToStaticMarkup(<PageLayout title={frontmatter.title?? "Untitled"} description={frontmatter.description??""}>{htmlContent}</PageLayout>);

            write(hash+".html", staticHtml);
        }
        
    }
    catch (error) {
        console.error(error)
    }
    
}



build()








