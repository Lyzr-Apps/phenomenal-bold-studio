import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Upload,
  Download,
  AlertTriangle,
  CheckCircle,
  FileText,
  TrendingUp,
  AlertCircle,
  Clock,
  Filter,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { cn } from '@/lib/utils'
import parseLLMJson from '@/utils/jsonParser'
import { callAIAgent, useAIAgent } from '@/utils/aiAgent'

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  account: string
  category?: string
  merchant?: string
}

interface Anomaly {
  id: string
  transaction_id: string
  anomaly_type: string
  confidence: number
  description: string
}

interface SummaryData {
  summary: {
    overview: string
    anomalies: Array<{
      id: string
      explanation: string
      possible_causes: string[]
      recommendation: string
    }>
    patterns_detected: string[]
    risk_level: 'High' | 'Medium' | 'Low'
  }
}

interface ReportData {
  report: {
    title: string
    generated_date: string
    sections: Array<{
      title: string
      content?: string
      anomalies?: string[]
      action_items?: string[]
    }>
    format: 'pdf' | 'text'
    metadata: {
      report_id: string
      timestamp: string
    }
  }
}

type ProcessingStep = 'upload' | 'detecting' | 'summarizing' | 'reporting' | 'complete'

const AnomalyTypeBadge = ({ type }: { type: string }) => {
  const typeConfig = {
    'Amount Anomaly': { color: 'destructive', icon: TrendingUp },
    'Pattern Anomaly': { color: 'warning', icon: AlertCircle },
    'Timing Anomaly': { color: 'secondary', icon: Clock },
    'Category Anomaly': { color: 'default', icon: Filter }
  }[type] || { color: 'default', icon: AlertCircle }

  return (
    <Badge variant={typeConfig.color as any} className="gap-1">
      <typeConfig.icon className="w-3 h-3" />
      {type}
    </Badge>
  )
}

const RiskLevelBadge = ({ level }: { level: string }) => {
  const config = {
    'High': { color: 'destructive', icon: AlertTriangle },
    'Medium': { color: 'warning', icon: AlertCircle },
    'Low': { color: 'default', icon: CheckCircle }
  }[level] || { color: 'default', icon: AlertCircle }

  return (
    <Badge variant="outline" className="gap-1">
      <config.icon className="w-3 h-3" />
      {level} Risk
    </Badge>
  )
}

const AnimatedLoader = ({ step, currentStep }: { step: ProcessingStep, currentStep: ProcessingStep }) => {
  const steps = ['upload', 'detecting', 'summarizing', 'reporting']
  const stepNames = {
    'upload': 'Uploading CSV',
    'detecting': 'Detecting Anomalies',
    'summarizing': 'Analyzing Results',
    'reporting': 'Generating Report'
  }

  const currentIndex = steps.indexOf(currentStep)
  const stepIndex = steps.indexOf(step)
  const isActive = stepIndex <= currentIndex
  const isCurrent = step === currentStep

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg transition-all duration-500",
      isActive ? 'bg-blue-50 dark:bg-blue-950' : 'bg-gray-50 dark:bg-gray-900'
    )}>
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300",
        isActive ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-500'
      )}>
        {isActive && !isCurrent ? (
          <CheckCircle className="w-4 h-4" />
        ) : (
          stepIndex + 1
        )}
      </div>
      <div className="flex-1">
        <div className={cn(
          "font-medium transition-colors duration-300",
          isActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'
        )}>
          {stepNames[step as keyof typeof stepNames]}
        </div>
      </div>
      {isCurrent && (
        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      )}
    </div>
  )
}

const ProcessingScreen = ({ currentStep }: { currentStep: ProcessingStep }) => {
  const steps: ProcessingStep[] = ['detecting', 'summarizing', 'reporting']

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-2xl mx-auto pt-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">SmartLedger</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">Processing your financial data...</p>
        </div>

        <Card className="p-8 shadow-xl">
          <div className="space-y-4 mb-8">
            {steps.map(step => (
              <AnimatedLoader key={step} step={step} currentStep={currentStep} />
            ))}
          </div>

          <Progress
            value={steps.indexOf(currentStep) * 33}
            className="h-2 mb-4"
          />

          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            Please wait while we analyze your transaction data...
          </div>
        </Card>
      </div>
    </div>
  )
}

const ResultsScreen = ({
  reportData,
  summaryData,
  anomalyData,
  onDownload,
  onNewAnalysis
}: {
  reportData: ReportData
  summaryData: SummaryData
  anomalyData: Array<Anomaly & Transaction & { expanded?: boolean }>
  onDownload: (format: 'pdf' | 'text') => void
  onNewAnalysis: () => void
}) => {
  const [anomalies, setAnomalies] = useState(anomalyData)

  const toggleExpansion = (id: string) => {
    setAnomalies(prev => prev.map(item =>
      item.id === id ? { ...item, expanded: !item.expanded } : item
    ))
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">SmartLedger</h1>
            <div className="flex gap-2">
              <Button onClick={() => onDownload('pdf')} variant="default" className="gap-2">
                <Download className="w-4 h-4" />
                Export PDF
              </Button>
              <Button onClick={() => onDownload('text')} variant="outline" className="gap-2">
                <FileText className="w-4 h-4" />
                Export Text
              </Button>
              <Button onClick={onNewAnalysis} variant="secondary">
                New Analysis
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
        {/* Summary Panel */}
        <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Analysis Summary</h2>
              <RiskLevelBadge level={summaryData.summary.risk_level} />
            </div>
            <div className="text-right text-sm text-gray-500 dark:text-gray-400">
              Report ID: {reportData.report.metadata.report_id}
              <br />
              Generated: {new Date(reportData.report.generated_date).toLocaleDateString()}
            </div>
          </div>
          <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
            {summaryData.summary.overview}
          </p>
        </Card>

        {/* Anomalies List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Flagged Transactions ({anomalies.length})
            </h2>
          </div>

          {anomalies.map((anomaly) => (
            <Card key={anomaly.id} className="overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {anomaly.description}
                      </span>
                    </div>
                    <AnomalyTypeBadge type={anomaly.anomaly_type} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      ${anomaly.amount.toLocaleString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpansion(anomaly.id)}
                      className="ml-4"
                    >
                      {anomaly.expanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <div>
                    <span className="font-medium">Date:</span> {new Date(anomaly.date).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Account:</span> {anomaly.account}
                  </div>
                  <div>
                    <span className="font-medium">Confidence:</span> {(anomaly.confidence * 100).toFixed(1)}%
                  </div>
                </div>

                {anomaly.expanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                    {summaryData.summary.anomalies.find(a => a.id === anomaly.id) && (
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Explanation:</h4>
                          <p className="text-gray-700 dark:text-gray-300 text-sm">
                            {summaryData.summary.anomalies.find(a => a.id === anomaly.id)?.explanation}
                          </p>
                        </div>

                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Possible Causes:</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {summaryData.summary.anomalies.find(a => a.id === anomaly.id)?.possible_causes.map((cause, idx) => (
                              <li key={idx} className="text-gray-700 dark:text-gray-300 text-sm">{cause}</li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Recommendation:</h4>
                          <p className="text-gray-700 dark:text-gray-300 text-sm">
                            {summaryData.summary.anomalies.find(a => a.id === anomaly.id)?.recommendation}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Patterns Detected */}
        {summaryData.summary.patterns_detected.length > 0 && (
          <Card className="p-6 bg-green-50 dark:bg-green-900/20">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Patterns Detected
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {summaryData.summary.patterns_detected.map((pattern, idx) => (
                <Badge key={idx} variant="outline" className="justify-start px-3 py-2">
                  {pattern}
                </Badge>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('upload')
  const [anomalies, setAnomalies] = useState<Array<Anomaly & Transaction>>([])
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { callAgent: callSummaryAgent, loading: summaryLoading } = useAIAgent()
  const { callAgent: callReportAgent, loading: reportLoading } = useAIAgent()

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
    }
  }, [])

  const parseCSV = async (file: File): Promise<Transaction[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          const lines = text.split('\n').filter(line => line.trim())

          if (lines.length < 2) {
            reject(new Error('CSV file must have header and data rows'))
            return
          }

          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
          const transactions: Transaction[] = []

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
            if (values.length >= 4) {
              transactions.push({
                id: values[0] || Date.now().toString() + i,
                date: values[1] || new Date().toISOString(),
                description: values[2] || '',
                amount: parseFloat(values[3]) || 0,
                account: values[4] || 'Unknown',
                category: values[5] || 'Uncategorized',
                merchant: values[6] || values[2]?.split(' ')[0] || 'Unknown'
              })
            }
          }
          resolve(transactions)
        } catch (err) {
          reject(new Error('Failed to parse CSV file. Please ensure it has the correct format.'))
        }
      }
      reader.readAsText(file)
    })
  }

  const detectAnomalies = (transactions: Transaction[]): Anomaly[] => {
    const anomalies: Anomaly[] = []
    const avgAmount = transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length
    const stdDev = Math.sqrt(transactions.reduce((sum, t) => sum + Math.pow(t.amount - avgAmount, 2), 0) / transactions.length)

    transactions.forEach((transaction, index) => {
      // Amount anomaly detection
      if (Math.abs(transaction.amount - avgAmount) > 2 * stdDev) {
        anomalies.push({
          id: `${transaction.id}_AMOUNT`,
          transaction_id: transaction.id,
          anomaly_type: 'Amount Anomaly',
          confidence: Math.min(0.95, Math.abs(transaction.amount - avgAmount) / (3 * stdDev)),
          description: `Unusually ${transaction.amount > avgAmount ? 'high' : 'low'} amount: $${transaction.amount.toLocaleString()}`
        })
      }

      // Timing anomaly (transactions too close together)
      if (index > 0) {
        const timeDiff = new Date(transaction.date).getTime() - new Date(transactions[index - 1].date).getTime()
        const hoursDiff = timeDiff / (1000 * 60 * 60)
        if (hoursDiff < 1 && Math.abs(transaction.amount) > avgAmount * 0.5) {
          anomalies.push({
            id: `${transaction.id}_TIMING`,
            transaction_id: transaction.id,
            anomaly_type: 'Timing Anomaly',
            confidence: 0.8,
            description: `Rapid transaction within ${hoursDiff.toFixed(1)} hours`
          })
        }
      }

      // Pattern anomaly (round numbers for large amounts)
      if (transaction.amount % 100 === 0 && transaction.amount > avgAmount) {
        anomalies.push({
          id: `${transaction.id}_PATTERN`,
          transaction_id: transaction.id,
          anomaly_type: 'Pattern Anomaly',
          confidence: 0.7,
          description: `Suspect round number amount: $${transaction.amount.toLocaleString()}`
        })
      }
    })

    return anomalies.slice(0, 10) // Limit to top 10 anomalies
  }

  const generateDummyData = (): Transaction[] => {
    const dummyData: Transaction[] = [
      { id: 'T001', date: '2024-01-15', description: 'Grocery Store Purchase', amount: 124.56, account: 'Checking-1234', category: 'Groceries', merchant: 'WholeFoods' },
      { id: 'T002', date: '2024-01-15T10:30:00', description: 'Coffee Shop Purchase', amount: 8.95, account: 'Checking-1234', category: 'Dining', merchant: 'Starbucks' },
      { id: 'T003', date: '2024-01-16', description: 'Gas Station Purchase', amount: 67.89, account: 'Checking-1234', category: 'Transportation', merchant: 'Shell' },
      { id: 'T004', date: '2024-01-16T15:00:00', description: 'Restaurant Purchase', amount: 1250.0, account: 'Checking-1234', category: 'Dining', merchant: 'FineDining' },
      { id: 'T005', date: '2024-01-17', description: 'Utility Payment', amount: 185.43, account: 'Checking-1234', category: 'Utilities', merchant: 'ElectricCo' },
      { id: 'T006', date: '2024-01-17T21:30:00', description: 'Online Purchase', amount: 1500.0, account: 'Checking-1234', category: 'Shopping', merchant: 'Amazon' },
      { id: 'T007', date: '2024-01-18', description: 'ATM Withdrawal', amount: 300.0, account: 'Checking-1234', category: 'Cash', merchant: 'ATM' },
      { id: 'T008', date: '2024-01-18T23:00:00', description: 'Online Gambling', amount: 2000.0, account: 'Checking-1234', category: 'Entertainment', merchant: 'CasinoSite' },
      { id: 'T009', date: '2024-01-19', description: 'Grocery Store Purchase', amount: 85.32, account: 'Checking-1234', category: 'Groceries', merchant: 'Kroger' },
      { id: 'T010', date: '2024-01-20', description: 'Coffee Shop Purchase', amount: 6.78, account: 'Checking-1234', category: 'Dining', merchant: 'Dunkin' }
    ]
    return dummyData
  }

  const downloadDummyCSV = () => {
    const csvHeaders = 'id,date,description,amount,account,category,merchant'
    const csvData = generateDummyData().map(t => `${t.id},"${t.date}","${t.description}",${t.amount},"${t.account}","${t.category}","${t.merchant}"`).join('\n')
    const csvContent = `${csvHeaders}\n${csvData}`

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dummy_transactions.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const processFile = async () => {
    if (!file) return

    try {
      setProcessingStep('detecting')
      setError(null)

      // Parse CSV and detect anomalies
      const transactions = await parseCSV(file)
      const detectedAnomalies = detectAnomalies(transactions)

      // Combine anomalies with transaction data
      const enrichedAnomalies = detectedAnomalies.map(anomaly => ({
        ...anomaly,
        ...transactions.find(t => t.id === anomaly.transaction_id)
      }))

      setAnomalies(enrichedAnomalies)

      // Prepare summary data
      const anomalySummary = {
        summary: {
          overview: '',
          anomalies: enrichedAnomalies.map(anomaly => ({
            id: anomaly.id,
            explanation: anomaly.description,
            possible_causes: [
              anomaly.anomaly_type === 'Amount Anomaly' ? 'Possible fraudulent transaction' :
              anomaly.anomaly_type === 'Timing Anomaly' ? 'Automated or bot activity' :
              anomaly.anomaly_type === 'Pattern Anomaly' ? 'Structured money movement' : 'Review transaction details'
            ],
            recommendation: 'Review transaction details and verify with account holder.'
          })),
          patterns_detected: detectedAnomalies.length > 5 ? [
            'High frequency of anomalies', 'Multiple suspect transactions'
          ] : [
            'Isolated suspicious activity'
          ],
          risk_level: (detectedAnomalies.length > 7 ? 'High' : detectedAnomalies.length > 3 ? 'Medium' : 'Low') as 'High' | 'Medium' | 'Low'
        }
      }

      // Call SummaryAgent
      setProcessingStep('summarizing')
      const summaryMessage = `Analyze these ${detectedAnomalies.length} financial transaction anomalies and provide a comprehensive summary with overview, detailed explanations for each anomaly, possible causes, and recommendations.`
      const summaryAgentResult = await callSummaryAgent(summaryMessage, '68efd29b8e20123158f3f2cd')
      const parsedSummary = parseLLMJson(summaryAgentResult.response, anomalySummary) as SummaryData
      setSummaryData(parsedSummary)

      // Call ReportAgent
      setProcessingStep('reporting')
      const reportMessage = `Create a professional financial anomaly analysis report based on these ${detectedAnomalies.length} anomalies with sections for executive summary, detailed findings, and recommendations. Include proper formatting and metadata.`
      const reportAgentResult = await callReportAgent(reportMessage, '68efd2aaeed55e88460e00ea')
      const parsedReport = parseLLMJson(reportAgentResult.response, {
        report: {
          title: 'Transaction Anomaly Analysis Report',
          generated_date: new Date().toISOString(),
          sections: [
            { title: 'Executive Summary', content: parsedSummary.summary.overview },
            {
              title: 'Detailed Findings',
              anomalies: parsedSummary.summary.anomalies.map(a => a.explanation)
            },
            {
              title: 'Recommendations',
              action_items: [
                'Review flagged transactions', 'Verify suspicious activity', 'Implement additional monitoring'
              ]
            }
          ],
          format: 'pdf',
          metadata: {
            report_id: 'RPT' + Date.now().toString(),
            timestamp: new Date().toISOString()
          }
        }
      }) as ReportData
      setReportData(parsedReport)

      setProcessingStep('complete')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setProcessingStep('upload')
    }
  }

  const handleDownload = (format: 'pdf' | 'text') => {
    if (!reportData) return

    const reportContent = `
SmartLedger Transaction Anomaly Analysis Report
=====================================================

Title: ${reportData.report.title}
Generated: ${new Date(reportData.report.generated_date).toLocaleDateString()}
Report ID: ${reportData.report.metadata.report_id}

${reportData.report.sections.map(section => `
${section.title}
${'='.repeat(section.title.length)}
${section.content || section.anomalies?.join('\n') || section.action_items?.join('\n') || ''}
`).join('\n')}

Anomaly Detection Summary
------------------------
Total Anomalies Found: ${anomalies.length}
Risk Level: ${summaryData?.summary.risk_level || 'Unknown'}
Analyzed Transactions: ${anomalies.length > 0 ? anomalies.length : 0}

Generated by SmartLedger AI Analysis
Timestamp: ${new Date().toISOString()}
    `

    const blob = new Blob([reportContent], { type: format === 'pdf' ? 'application/pdf' : 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `smartledger-report-${format}-${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : 'txt'}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const resetAnalysis = () => {
    setFile(null)
    setProcessingStep('upload')
    setAnomalies([])
    setSummaryData(null)
    setReportData(null)
    setError(null)
  }

  if (processingStep === 'upload') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-4xl mx-auto pt-20 px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">SmartLedger</h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
              AI-Powered Financial Transaction Analysis
            </p>
            <p className="text-gray-500 dark:text-gray-500 max-w-2xl mx-auto">
              Upload your CSV transaction file and let our AI analyze for anomalies, patterns, and potential fraud indicators
            </p>
          </div>

          {/* Upload Area */}
          <Card className="p-8 shadow-xl mb-8">
            <div className="text-center">
              <div className="mb-6">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Upload Transaction CSV File
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Select a CSV file with transaction data including date, description, amount, and account
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <div className="px-6 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-500" />
                        <span className="text-gray-600 dark:text-gray-400">
                          {file ? file.name : 'Choose CSV file...'}
                        </span>
                      </div>
                    </div>
                  </label>
                </div>

                <div className="flex justify-center">
                  <Button variant="ghost" size="sm" onClick={downloadDummyCSV} className="gap-2">
                    <Download className="w-4 h-4" />
                    Download Sample CSV
                  </Button>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertTitle>Processing Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {file && (
                  <div className="flex justify-center gap-4">
                    <Button onClick={processFile} size="lg" className="gap-2">
                      Analyze Transactions
                    </Button>
                    <Button variant="outline" onClick={() => setFile(null)}>
                      Clear File
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 text-center">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Anomaly Detection</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                AI-powered detection of unusual patterns in your transaction data
              </p>
            </Card>

            <Card className="p-6 text-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Smart Reporting</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Generate comprehensive reports with AI analysis and recommendations
              </p>
            </Card>

            <Card className="p-6 text-center">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Pattern Analysis</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Identify spending patterns and detect potential fraud indicators
              </p>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (processingStep !== 'complete') {
    return <ProcessingScreen currentStep={processingStep} />
  }

  return (
    <ResultsScreen
      reportData={reportData!}
      summaryData={summaryData!}
      anomalyData={anomalies}
      onDownload={handleDownload}
      onNewAnalysis={resetAnalysis}
    />
  )
}