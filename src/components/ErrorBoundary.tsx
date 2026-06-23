import React, { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error boundary caught error:", error, errorInfo);
    (this as any).setState({ error, errorInfo });
  }

  private handleReset = () => {
    (this as any).setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    const currentState = (this as any).state as State;
    if (currentState.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center p-6 font-sans text-[#5c4a37]">
          <div className="bg-white/90 backdrop-blur-md p-8 rounded-2xl shadow-xl max-w-lg w-full border border-[#E8DFC8] text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h1 className="text-2xl font-bold text-[#8C6D3F] mb-3">Ocorreu um Erro Inesperado</h1>
            <p className="text-stone-600 mb-6 text-sm leading-relaxed">
              Não se preocupe, os seus dados não foram corrompidos. Ocorreu uma interrupção temporária ao renderizar ou ler algum elemento de script dinâmico.
            </p>

            <div className="bg-[#FAF6EE] border border-[#DECFA4] rounded-lg p-4 mb-6 text-left max-h-48 overflow-y-auto">
              <p className="text-xs font-mono font-bold text-[#8C6D3F] mb-1">
                {currentState.error?.name || "Erro de Script"}: {currentState.error?.message || "Script error ou erro na execução de dependência."}
              </p>
              {currentState.errorInfo && (
                <pre className="text-[10px] font-mono text-stone-500 leading-tight whitespace-pre-wrap mt-2">
                  {currentState.errorInfo.componentStack}
                </pre>
              )}
            </div>

            <div className="flex gap-4 justify-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-6 py-2.5 bg-[#8C6D3F] hover:bg-[#735932] text-white text-sm font-semibold rounded-lg shadow-md transition-all duration-200"
              >
                Recarregar Aplicação
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
