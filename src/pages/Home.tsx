import { useState } from "react";
import { 
  Activity, 
  BarChart3, 
  FileText, 
  Settings, 
  Menu,
  X,
  Brain,
  Heart,
  Stethoscope,
  Shield
} from "lucide-react";
import EDFUpload from "../components/EDFUpload";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Shadcn-style Dashboard Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container flex h-16 items-center">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 lg:hidden"
          >
            {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          {/* Logo and brand */}
          <div className="flex items-center space-x-4 lg:space-x-6">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg">
                <Brain className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">SomnoViz</h1>
                <p className="text-xs text-slate-500">Sleep Study Platform</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden lg:flex lg:space-x-8 lg:ml-8">
            <a href="#" className="flex items-center space-x-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600 pb-4">
              <Activity className="h-4 w-4" />
              <span>Analysis</span>
            </a>
           {/* <a href="#" className="flex items-center space-x-2 text-sm font-medium text-slate-600 hover:text-slate-900 pb-4">
              <BarChart3 className="h-4 w-4" />
              <span>Reports</span>
            </a>
            <a href="#" className="flex items-center space-x-2 text-sm font-medium text-slate-600 hover:text-slate-900 pb-4">
              <FileText className="h-4 w-4" />
              <span>Studies</span>
            </a>
            <a href="#" className="flex items-center space-x-2 text-sm font-medium text-slate-600 hover:text-slate-900 pb-4">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </a>*/}
          </nav>

          {/* Right side - Medical badges */}
          <div className="ml-auto flex items-center space-x-4">
            <div className="hidden lg:flex items-center space-x-3">
              <div className="flex items-center space-x-1 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                <Shield className="h-3 w-3" />
                <span>HIPAA Compliant</span>
              </div>
              <div className="flex items-center space-x-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                <Stethoscope className="h-3 w-3" />
                <span>Medical Grade</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-slate-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex w-full max-w-xs flex-col bg-white">
            <div className="flex h-16 items-center justify-between px-4 border-b border-slate-200">
              <div className="flex items-center space-x-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white">
                  <Brain className="h-4 w-4" />
                </div>
                <span className="text-lg font-semibold text-slate-900">SomnoViz</span>
              </div>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="h-6 w-6 text-slate-400" />
              </button>
            </div>
            <nav className="flex-1 px-4 py-4 space-y-2">
              <a href="#" className="flex items-center space-x-3 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg">
                <Activity className="h-4 w-4" />
                <span>Analysis</span>
              </a>
              <a href="#" className="flex items-center space-x-3 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">
                <BarChart3 className="h-4 w-4" />
                <span>Reports</span>
              </a>
              <a href="#" className="flex items-center space-x-3 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">
                <FileText className="h-4 w-4" />
                <span>Studies</span>
              </a>
              <a href="#" className="flex items-center space-x-3 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </a>
            </nav>
          </div>
        </div>
      )}

      {/* Main content area */}
      <main className="container mx-auto px-4 py-8">
        {/* Flatiron Health-inspired hero section */}
        <div className="mb-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-full text-blue-700 text-sm font-medium mb-6">
              <Heart className="h-4 w-4" />
              <span>Advanced Sleep Study Analysis</span>
            </div>
            <h1 className="text-4xl font-bold text-slate-900 mb-4">
              Comprehensive Polysomnographic 
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"> Analysis Platform</span>
            </h1>
            <p className="text-xl text-slate-600 mb-8 leading-relaxed">
              Upload EDF recordings and explore sleep study data with professional-grade visualization tools, 
              AHI analysis, and comprehensive reporting capabilities.
            </p>
            
            {/* Medical credibility indicators */}
            <div className="flex flex-wrap justify-center gap-6 mb-8">
              <div className="flex items-center space-x-2 text-slate-600">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span className="text-sm font-medium">FDA Compliant Algorithms</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-600">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium">Clinical Grade Accuracy</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-600">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-sm font-medium">AASM Standards</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main dashboard content */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <EDFUpload />
        </div>

        {/* Footer with medical compliance info */}
        <footer className="mt-16 pt-8 border-t border-slate-200">
          <div className="flex flex-col lg:flex-row justify-between items-center space-y-4 lg:space-y-0">
            <div className="flex items-center space-x-6 text-sm text-slate-500">
              <span>© 2025 SomnoViz. All rights reserved.</span>
              <span>•</span>
              <span>HIPAA Compliant</span>
              <span>•</span>
              <span>SOC 2 Type II</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 px-3 py-1 bg-slate-50 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-600 font-medium">System Status: Operational</span>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}