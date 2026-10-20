import Head from "next/head";
import Link from "next/link";
import { CFG, isProd } from "../lib/config";
import { CHAIN } from "../lib/chain";
export default function Layout({ title, right, children }) {
  return (<>
    <Head><title>{title ? `${title} | Rare Trial Registry` : "Rare Trial Registry"}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <meta name="description" content="Find rare disease trials without giving up your privacy." /></Head>
    <a className="skip" href="#main">Skip to content</a>
    {!isProd && <div className="bar">Staging environment. Do not enter real patient information.</div>}
    <div className="nav"><div className="wrap">
      <Link href="/" className="brand">Rare Trial Registry</Link>
      <nav className="links" aria-label="Main"><Link href="/"><button>Home</button></Link><Link href="/diseases"><button>Diseases</button></Link></nav>
      <div>{right}</div></div></div>
    <div className="wrap"><main id="main" tabIndex={-1}>{children}</main></div>
    <footer><div className="wrap">
      <div className="fcols">
        <div><strong>Rare Trial Registry</strong><p>Privacy-first matching of rare disease patients with clinical trials.</p></div>
        <div><strong>Explore</strong><Link href="/">Patients and researchers</Link><Link href="/diseases">Disease library</Link></div>
        <div><strong>Legal</strong><Link href="/privacy">Privacy policy</Link><Link href="/terms">Terms of use</Link></div>
        <div><strong>Operator</strong><span>{CFG.org}</span><span>{CHAIN.name}</span>{CFG.auditUrl && <a href={CFG.auditUrl}>Independent security audit</a>}</div>
      </div>
      <p className="fine">Disease information is general and is not medical advice. Please ask a qualified clinician about your own care.</p>
    </div></footer></>);
}
