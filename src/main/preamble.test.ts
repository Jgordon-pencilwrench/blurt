import { describe, it, expect } from 'vitest'
import { stripPreamble, stripThinkBlocks, stripLLMArtifacts, extractBlurtOutput, extractStreamingVisible } from './preamble'

describe('stripPreamble', () => {
  it('strips "Here are your notes:" intro', () => {
    const input = 'Here are your cleaned notes:\n\n- Point 1\n- Point 2'
    expect(stripPreamble(input)).toBe('- Point 1\n- Point 2')
  })

  it('strips "Here is the message:" intro', () => {
    const input = "Here's the cleaned message:\n\nLet me know when you're free."
    expect(stripPreamble(input)).toBe("Let me know when you're free.")
  })

  it('strips "Sure! Here are..." multi-line preamble', () => {
    const input = 'Sure! Here are the notes:\n\n- Item 1'
    expect(stripPreamble(input)).toBe('- Item 1')
  })

  it('strips "Below are the key points:" intro', () => {
    const input = 'Below are the key points:\n\n1. First\n2. Second'
    expect(stripPreamble(input)).toBe('1. First\n2. Second')
  })

  it('strips "Certainly! Here is your note:" intro', () => {
    const input = 'Certainly! Here is your note:\n\nThe meeting is at 3pm.'
    expect(stripPreamble(input)).toBe('The meeting is at 3pm.')
  })

  it('does not strip normal content that starts with a colon-ending line', () => {
    const input = 'Fix the auth bug:\n- Check token expiry\n- Validate refresh logic'
    expect(stripPreamble(input)).toBe('Fix the auth bug:\n- Check token expiry\n- Validate refresh logic')
  })

  it('does not strip content with no preamble', () => {
    const input = '- Point 1\n- Point 2'
    expect(stripPreamble(input)).toBe('- Point 1\n- Point 2')
  })

  it('does not strip prose that happens to start with Here', () => {
    const input = 'Here we have a system that processes audio in real time.'
    expect(stripPreamble(input)).toBe('Here we have a system that processes audio in real time.')
  })

  it('trims leading whitespace from input', () => {
    const input = '\n\n- Point 1\n- Point 2'
    expect(stripPreamble(input)).toBe('- Point 1\n- Point 2')
  })

  it('handles empty string', () => {
    expect(stripPreamble('')).toBe('')
  })

  it('strips "Of course! Here are..." intro', () => {
    const input = 'Of course! Here are your notes:\n\n- Item A'
    expect(stripPreamble(input)).toBe('- Item A')
  })

  it('strips "Absolutely! Here is..." intro', () => {
    const input = 'Absolutely! Here is the cleaned text:\n\nReady to send.'
    expect(stripPreamble(input)).toBe('Ready to send.')
  })

  it('strips "The following notes have been cleaned:" intro', () => {
    const input = 'The following notes have been cleaned:\n\n- Point 1'
    expect(stripPreamble(input)).toBe('- Point 1')
  })

  it('strips "Alright, here is your summary:" intro', () => {
    const input = 'Alright, here is your summary:\n\nKey takeaways below.'
    expect(stripPreamble(input)).toBe('Key takeaways below.')
  })
})

describe('stripThinkBlocks', () => {
  it('strips empty think block', () => {
    expect(stripThinkBlocks('<think></think>\nHello world')).toBe('Hello world')
  })

  it('strips think block with content', () => {
    expect(stripThinkBlocks('<think>reasoning here</think>\nHello world')).toBe('Hello world')
  })

  it('strips multiline think block', () => {
    expect(stripThinkBlocks('<think>\nstep 1\nstep 2\n</think>\nResult')).toBe('Result')
  })

  it('passes through text with no think block', () => {
    expect(stripThinkBlocks('Hello world')).toBe('Hello world')
  })

  it('handles partial think block (still open — incomplete stream)', () => {
    expect(stripThinkBlocks('<think>still thinking')).toBe('')
  })
})

describe('extractStreamingVisible', () => {
  it('returns empty before blurt_output tag appears', () => {
    expect(extractStreamingVisible('<think>reasoning</think>\n')).toBe('')
  })

  it('returns empty while blurt_output tag is still forming (no closing >)', () => {
    expect(extractStreamingVisible('<blurt_output')).toBe('')
  })

  it('returns empty for bare < that could be start of opening tag', () => {
    expect(extractStreamingVisible('<')).toBe('')
  })

  it('strips partial closing tag chars from streamed content', () => {
    expect(extractStreamingVisible('<blurt_output>Hello</blurt_outp')).toBe('Hello')
  })

  it('strips single < that starts the closing tag sequence', () => {
    expect(extractStreamingVisible('<blurt_output>Hello<')).toBe('Hello')
  })

  it('returns content progressively once inside open tag', () => {
    expect(extractStreamingVisible('<blurt_output>Hello')).toBe('Hello')
  })

  it('returns trimmed content from complete tag', () => {
    expect(extractStreamingVisible('<blurt_output>\nHello world\n</blurt_output>')).toBe('Hello world')
  })

  it('returns full content when no tags present (fallback)', () => {
    expect(extractStreamingVisible('Hello world')).toBe('Hello world')
  })

  it('fallback strips think blocks', () => {
    expect(extractStreamingVisible('<think>reasoning</think>\nHello world')).toBe('Hello world')
  })
})

describe('extractBlurtOutput', () => {
  it('extracts content from blurt_output tags', () => {
    expect(extractBlurtOutput('<blurt_output>Hello world</blurt_output>')).toBe('Hello world')
  })

  it('ignores content outside the tags', () => {
    expect(extractBlurtOutput('<think>reasoning</think>\n<blurt_output>Hello world</blurt_output>')).toBe('Hello world')
  })

  it('handles multiline content inside tags', () => {
    expect(extractBlurtOutput('<blurt_output>Line one\nLine two</blurt_output>')).toBe('Line one\nLine two')
  })

  it('trims whitespace inside tags', () => {
    expect(extractBlurtOutput('<blurt_output>\n  Hello world\n</blurt_output>')).toBe('Hello world')
  })

  it('falls back to full stripping pipeline when no tags present', () => {
    expect(extractBlurtOutput('Hello world')).toBe('Hello world')
  })

  it('fallback strips think blocks and artifacts', () => {
    expect(extractBlurtOutput('<think>reasoning</think>\nHello world\n[end of text]')).toBe('Hello world')
  })
})

describe('stripLLMArtifacts', () => {
  it('strips "[end of text]"', () => {
    expect(stripLLMArtifacts('Hello world\n[end of text]')).toBe('Hello world')
  })

  it('strips case-insensitively', () => {
    expect(stripLLMArtifacts('Hello world\n[END OF TEXT]')).toBe('Hello world')
  })

  it('passes through normal text', () => {
    expect(stripLLMArtifacts('Hello world')).toBe('Hello world')
  })
})
