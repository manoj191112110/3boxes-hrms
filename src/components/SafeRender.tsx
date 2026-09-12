'use client';

import React from 'react';

interface SafeRenderProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface SafeRenderState {
  hasError: boolean;
}

/**
 * A lightweight error boundary wrapper that catches render errors
 * in child components and renders a fallback instead of crashing the whole page.
 */
export default class SafeRender extends React.Component<SafeRenderProps, SafeRenderState> {
  constructor(props: SafeRenderProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): SafeRenderState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[SafeRender] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}
