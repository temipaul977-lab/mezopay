"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="main" className="page-shell"><div className="checkout-problem"><h1>Something interrupted your workspace.</h1><p>Please try again. If you just submitted a transaction, check your wallet or the explorer before resubmitting.</p><button onClick={reset} className="btn-primary">Try again</button></div></main>;
}
