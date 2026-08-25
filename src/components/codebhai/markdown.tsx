'use client'

import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function CodeBlock({
  language,
  value,
}: {
  language: string
  value: string
}) {
  const [copied, setCopied] = React.useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard not available
    }
  }
  return (
    <div className="group relative my-3 overflow-hidden rounded-md border border-border bg-[#282c34]">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-3 py-1.5">
        <span className="font-mono text-xs text-muted-foreground">
          {language || 'code'}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCopy}
          aria-label="Copy code"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          {copied ? (
            <Check className="size-3.5 text-primary" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <div className="cb-scroll overflow-x-auto text-sm">
        <SyntaxHighlighter
          language={language || 'text'}
          style={oneDark}
          customStyle={{
            margin: 0,
            background: 'transparent',
            padding: '0.85rem 1rem',
            fontSize: '0.85rem',
            lineHeight: 1.55,
          }}
          codeTagProps={{
            style: {
              fontFamily:
                'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
            },
          }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}

export function Markdown({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'text-sm leading-relaxed text-foreground/90',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // react-markdown v10 no longer passes `inline`. We detect block
          // code by the presence of a `language-xxx` class OR a newline in
          // the content (inline code can't contain newlines in markdown).
          code({ className: cls, children, ...props }) {
            const match = /language-(\w+)/.exec(cls || '')
            const text = String(children || '').replace(/\n$/, '')
            if (match || text.includes('\n')) {
              return (
                <CodeBlock
                  language={match ? match[1] : ''}
                  value={text}
                />
              )
            }
            return (
              <code
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-primary"
                {...props}
              >
                {children}
              </code>
            )
          },
          pre({ children }) {
            // We render the CodeBlock inside `code`; suppress the default
            // <pre> wrapper which would double-wrap.
            return <>{children}</>
          },
          a({ children, href, ...props }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary underline underline-offset-2 hover:opacity-80"
                {...props}
              >
                {children}
              </a>
            )
          },
          table({ children }) {
            return (
              <div className="cb-scroll my-3 overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">{children}</table>
              </div>
            )
          },
          thead({ children }) {
            return (
              <thead className="bg-muted/50">{children}</thead>
            )
          },
          th({ children }) {
            return (
              <th className="border-b border-border px-3 py-2 text-left font-medium">
                {children}
              </th>
            )
          },
          td({ children }) {
            return (
              <td className="border-b border-border/60 px-3 py-2 align-top">
                {children}
              </td>
            )
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-2 border-l-2 border-primary/60 pl-3 italic text-muted-foreground">
                {children}
              </blockquote>
            )
          },
          ul({ children }) {
            return (
              <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
            )
          },
          ol({ children }) {
            return (
              <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
            )
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>
          },
          h1({ children }) {
            return (
              <h1 className="mb-2 mt-4 text-xl font-semibold">{children}</h1>
            )
          },
          h2({ children }) {
            return (
              <h2 className="mb-2 mt-4 text-lg font-semibold">{children}</h2>
            )
          },
          h3({ children }) {
            return (
              <h3 className="mb-1.5 mt-3 text-base font-semibold">
                {children}
              </h3>
            )
          },
          h4({ children }) {
            return (
              <h4 className="mb-1 mt-2 text-sm font-semibold">{children}</h4>
            )
          },
          p({ children }) {
            return <p className="my-2 leading-relaxed">{children}</p>
          },
          hr() {
            return <hr className="my-4 border-border" />
          },
          input({ checked, ...props }) {
            // GFM task list checkbox
            return (
              <input
                type="checkbox"
                checked={checked}
                readOnly
                className="mr-2 size-3.5 accent-primary align-middle"
                {...props}
              />
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
