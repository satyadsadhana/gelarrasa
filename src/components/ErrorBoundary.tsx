import { Component, type ReactNode } from "react";

/** Mencegah satu komponen yang error membuat seluruh halaman kosong. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <div className="loading">
          Bagian ini gagal dimuat. <button className="link-btn" onClick={() => this.setState({ err: null })}>Coba lagi</button>
        </div>
      );
    }
    return this.props.children;
  }
}
