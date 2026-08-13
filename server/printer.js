import fs from 'fs'

// Gprinter GP-58 thermal receipt printer, wired to the Pi over USB and
// enumerating as a standard USB printer-class device. See
// ~/Documents/Recipt_Printer/ for the original test scripts this mirrors.
const DEVICE = process.env.PRINTER_DEVICE || '/dev/usb/lp0'
const LINE_WIDTH = 32
const ESC_INIT = Buffer.from([0x1b, 0x40]) // ESC @ — reset/initialize

// The printer only understands basic ASCII — anything else (accents,
// emoji, curly quotes) gets swapped for '?' rather than sent raw and
// garbling the print.
function toPrintableAscii(str) {
  return str.replace(/[^\x20-\x7e]/g, '?')
}

function wrapText(text, width = LINE_WIDTH) {
  const words = toPrintableAscii(text).split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (candidate.length > width) {
      if (line) lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

// Prints one crowd-sourced idea, bracketed by a rule line above and below
// so consecutive submissions on the same roll are easy to tell apart.
export function printCrowdIdea({ name, idea }) {
  const rule = '-'.repeat(LINE_WIDTH)
  const lines = [rule, `From: ${toPrintableAscii(name)}`, '', ...wrapText(idea), '', rule, '', '']
  const data = Buffer.concat([ESC_INIT, Buffer.from(lines.join('\n') + '\n', 'ascii')])
  fs.writeFileSync(DEVICE, data)
}
