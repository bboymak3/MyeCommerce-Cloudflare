"use client";

import React, { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.name ? `: ${this.props.name}` : ""}]`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
          <div className="text-4xl">&#9888;</div>
          <h3 className="text-lg font-semibold text-destructive">
            Error inesperado{this.props.name ? ` en ${this.props.name}` : ""}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Ocurrio un error al cargar esta seccion. Puede intentar recargar o continuar usando las demas funciones.
          </p>
          {this.state.error && (
            <p className="text-xs text-muted-foreground/70 font-mono max-w-md truncate">
              {this.state.error.message}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={this.handleRetry}>
              Reintentar
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Recargar Pagina
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
