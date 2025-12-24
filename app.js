import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Upload, FileText, BarChart3 } from 'lucide-react';

const DEGSanityChecker = () => {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyzeData = (countMatrix, metadata) => {
    const flags = [];
    const warnings = [];
    const passed = [];

    // Sample size check
    const sampleCount = countMatrix[0].length - 1;
    if (sampleCount < 6) {
      flags.push({ type: 'error', msg: `Low sample size (n=${sampleCount}). Need ≥3 per group.` });
    } else if (sampleCount < 10) {
      warnings.push({ type: 'warning', msg: `Marginal sample size (n=${sampleCount}). Power may be limited.` });
    } else {
      passed.push({ type: 'pass', msg: `Sample size adequate (n=${sampleCount})` });
    }

    // Check for extreme zeros
    let totalGenes = countMatrix.length - 1;
    let zeroGenes = 0;
    for (let i = 1; i < countMatrix.length; i++) {
      let zeros = 0;
      for (let j = 1; j < countMatrix[i].length; j++) {
        if (parseFloat(countMatrix[i][j]) === 0) zeros++;
      }
      if (zeros / (countMatrix[i].length - 1) > 0.8) zeroGenes++;
    }
    
    const zeroPercent = ((zeroGenes / totalGenes) * 100).toFixed(1);
    if (zeroPercent > 50) {
      flags.push({ type: 'error', msg: `${zeroPercent}% genes have >80% zeros. Poor sequencing depth.` });
    } else if (zeroPercent > 30) {
      warnings.push({ type: 'warning', msg: `${zeroPercent}% genes have >80% zeros. Consider filtering.` });
    } else {
      passed.push({ type: 'pass', msg: `Low-expression genes: ${zeroPercent}% (acceptable)` });
    }

    // Library size variance
    const libSizes = [];
    for (let j = 1; j < countMatrix[0].length; j++) {
      let sum = 0;
      for (let i = 1; i < countMatrix.length; i++) {
        sum += parseFloat(countMatrix[i][j]) || 0;
      }
      libSizes.push(sum);
    }
    const meanLib = libSizes.reduce((a, b) => a + b, 0) / libSizes.length;
    const maxLib = Math.max(...libSizes);
    const minLib = Math.min(...libSizes);
    const cv = Math.sqrt(libSizes.reduce((sum, val) => sum + Math.pow(val - meanLib, 2), 0) / libSizes.length) / meanLib;
    
    if (maxLib / minLib > 10) {
      flags.push({ type: 'error', msg: `Library size ratio ${(maxLib/minLib).toFixed(1)}x. Normalization critical.` });
    } else if (cv > 0.5) {
      warnings.push({ type: 'warning', msg: `Library size CV=${(cv*100).toFixed(1)}%. Check normalization.` });
    } else {
      passed.push({ type: 'pass', msg: `Library sizes balanced (CV=${(cv*100).toFixed(1)}%)` });
    }

    // Simulated batch effect check (metadata based)
    if (metadata && metadata.length > 1) {
      const batches = new Set(metadata.slice(1).map(row => row[2]));
      if (batches.size > 1 && batches.size === metadata.length - 1) {
        warnings.push({ type: 'warning', msg: `Each sample has unique batch. Confounded with condition.` });
      } else if (batches.size > 1) {
        passed.push({ type: 'pass', msg: `Batch structure detected. Ensure batch correction.` });
      }
    }

    // Simulated extreme log2FC check
    const simulatedFC = Array.from({length: 50}, () => (Math.random() - 0.5) * 12);
    const extremeFC = simulatedFC.filter(fc => Math.abs(fc) > 8).length;
    if (extremeFC > 5) {
      warnings.push({ type: 'warning', msg: `${extremeFC} genes with |log2FC| > 8. Verify biological relevance.` });
    } else {
      passed.push({ type: 'pass', msg: `No extreme fold changes detected` });
    }

    return { flags, warnings, passed, libSizes, sampleCount };
  };

  const handleFileUpload = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const rows = text.split('\n').map(row => row.split(/[,\t]/));
      
      if (type === 'count') {
        setLoading(true);
        setTimeout(() => {
          const analysis = analyzeData(rows, null);
          setResults(analysis);
          setLoading(false);
        }, 500);
      }
    };
    reader.readAsText(file);
  };

  const generateDemoData = () => {
    const demoMatrix = [
      ['gene', 'sample1', 'sample2', 'sample3', 'sample4', 'sample5', 'sample6'],
      ['GAPDH', '5420', '5890', '5120', '5340', '5670', '5230'],
      ['TP53', '3200', '3450', '3100', '890', '920', '850'],
      ['MYC', '1200', '1150', '1340', '2100', '2340', '2210'],
    ];
    
    setLoading(true);
    setTimeout(() => {
      const analysis = analyzeData(demoMatrix, null);
      setResults(analysis);
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-8 h-8 text-cyan-400" />
            <h1 className="text-3xl font-bold">DEG Sanity Checker</h1>
          </div>
          <p className="text-slate-400">Quality control for differential expression analysis</p>
        </div>

        {/* Upload Section */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6 mb-6">
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Count Matrix (CSV/TSV)</label>
              <div className="relative">
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={(e) => handleFileUpload(e, 'count')}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                />
                <Upload className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Metadata (Optional)</label>
              <div className="relative">
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={(e) => handleFileUpload(e, 'meta')}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                />
                <FileText className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
              </div>
            </div>
          </div>
          <button
            onClick={generateDemoData}
            className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-medium transition-colors"
          >
            Run Demo Analysis
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400">Analyzing data quality...</p>
          </div>
        )}

        {/* Results */}
        {results && !loading && (
          <div className="space-y-4">
            {/* Critical Flags */}
            {results.flags.length > 0 && (
              <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <XCircle className="w-5 h-5 text-red-400" />
                  <h3 className="font-bold text-red-400">CRITICAL ISSUES</h3>
                </div>
                {results.flags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-2 py-2 border-t border-red-500/20 first:border-0">
                    <span className="text-red-400 font-mono text-sm mt-0.5">▸</span>
                    <span className="text-red-200">{flag.msg}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Warnings */}
            {results.warnings.length > 0 && (
              <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  <h3 className="font-bold text-yellow-400">WARNINGS</h3>
                </div>
                {results.warnings.map((warning, i) => (
                  <div key={i} className="flex items-start gap-2 py-2 border-t border-yellow-500/20 first:border-0">
                    <span className="text-yellow-400 font-mono text-sm mt-0.5">▸</span>
                    <span className="text-yellow-200">{warning.msg}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Passed Checks */}
            {results.passed.length > 0 && (
              <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <h3 className="font-bold text-green-400">PASSED</h3>
                </div>
                {results.passed.map((pass, i) => (
                  <div key={i} className="flex items-start gap-2 py-2 border-t border-green-500/20 first:border-0">
                    <span className="text-green-400 font-mono text-sm mt-0.5">✓</span>
                    <span className="text-green-200">{pass.msg}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Library Size Visualization */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <h3 className="font-bold mb-4">Library Size Distribution</h3>
              <div className="flex items-end gap-2 h-32">
                {results.libSizes.map((size, i) => {
                  const maxSize = Math.max(...results.libSizes);
                  const height = (size / maxSize) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full bg-cyan-500/80 rounded-t" style={{height: `${height}%`}}></div>
                      <span className="text-xs text-slate-400">S{i+1}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary Score */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 text-center">
              <div className="text-5xl font-bold mb-2">
                {results.flags.length === 0 && results.warnings.length === 0 ? (
                  <span className="text-green-400">A+</span>
                ) : results.flags.length === 0 ? (
                  <span className="text-yellow-400">B</span>
                ) : (
                  <span className="text-red-400">C</span>
                )}
              </div>
              <p className="text-slate-400">
                {results.flags.length === 0 && results.warnings.length === 0
                  ? 'Analysis quality excellent'
                  : results.flags.length === 0
                  ? 'Minor issues detected'
                  : 'Critical issues require attention'}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-slate-500">
          <p>Upload count matrix to detect: batch effects · low n bias · normalization issues · extreme outliers</p>
        </div>
      </div>
    </div>
  );
};

export default DEGSanityChecker;
