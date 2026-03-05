import { describe, it, expect } from 'vitest'
import { stripPreamble } from './preamble'

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
