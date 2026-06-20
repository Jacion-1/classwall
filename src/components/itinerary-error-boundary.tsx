"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

type ItineraryErrorBoundaryProps = {
  children: ReactNode;
  onBackHome?: () => void;
  resetKey?: string | number;
};

type ItineraryErrorBoundaryState = {
  error: Error | null;
};

export class ItineraryErrorBoundary extends Component<
  ItineraryErrorBoundaryProps,
  ItineraryErrorBoundaryState
> {
  state: ItineraryErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ItineraryErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[TripWall itinerary render error]", { error, info });
  }

  componentDidUpdate(prevProps: ItineraryErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <section className="rounded-2xl border border-destructive/30 bg-card p-8 text-center shadow-sm">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-xl font-semibold">行程表暫時無法顯示</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
          其中一筆行程資料格式不完整，系統已先阻止整個頁面崩潰。請重新載入行程表，或先回首頁繼續瀏覽。
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="min-h-10 rounded-full"
          >
            <RefreshCw className="h-4 w-4" />
            重新載入行程表
          </Button>
          {this.props.onBackHome ? (
            <Button
              type="button"
              variant="outline"
              onClick={this.props.onBackHome}
              className="min-h-10 rounded-full"
            >
              <Home className="h-4 w-4" />
              回首頁
            </Button>
          ) : null}
        </div>
        <p className="mt-4 break-words text-xs text-muted-foreground/75">
          {this.state.error.message}
        </p>
      </section>
    );
  }
}
