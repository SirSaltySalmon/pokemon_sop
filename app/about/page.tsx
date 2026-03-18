import { readFileSync, existsSync } from "fs";
import path from "path";
import { marked } from "marked";

export default async function AboutPage() {
  const readmePath = path.join(process.cwd(), "README.md");
  if (!existsSync(readmePath)) {
    return (
      <>
        <h1 className="page-title">About</h1>
        <p className="results-stats">README.md was not found.</p>
      </>
    );
  }
  const markdown = readFileSync(readmePath, "utf8");
  const html = await marked(markdown);
  return (
    <>
      <h1 className="page-title">About</h1>
      <article
        className="readme-prose"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
