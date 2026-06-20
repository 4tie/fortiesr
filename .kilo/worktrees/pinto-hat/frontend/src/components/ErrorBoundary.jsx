import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] Caught error in tab:", this.props.tabName || "unknown", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { tabName = "this tab" } = this.props;
    const message = this.state.error?.message || String(this.state.error);

    return (
      <div className="p-8 max-w-2xl mx-auto mt-10">
        <div role="alert" className="alert alert-error shadow-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">
              {tabName} encountered an unexpected error
            </p>
            <p className="text-sm mt-1 font-mono break-all opacity-80">{message}</p>
          </div>
          <button
            className="btn btn-sm btn-ghost ml-2 shrink-0"
            onClick={this.handleReset}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
