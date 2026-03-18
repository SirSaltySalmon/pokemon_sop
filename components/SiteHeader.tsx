import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <h1 className="site-title">
          <Link href="/">Salmon&apos;s Pokémon Smash or Pass</Link>
        </h1>
        <nav className="site-nav" aria-label="Main">
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <a
            href="https://github.com/SirSaltySalmon/usop"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
