import fs from 'fs'

// Gprinter GP-58 thermal receipt printer, wired to the Pi over USB and
// enumerating as a standard USB printer-class device. See
// ~/Documents/Recipt_Printer/ for the original test scripts this mirrors.
const DEVICE = process.env.PRINTER_DEVICE || '/dev/usb/lp0'
const LINE_WIDTH = 32
const ESC_INIT = Buffer.from([0x1b, 0x40]) // ESC @ — reset/initialize

// The printer is mounted physically upside down, so flip printing 180° to
// compensate — set PRINTER_UPSIDE_DOWN=false in .env if it's ever remounted
// the right way up.
const UPSIDE_DOWN = process.env.PRINTER_UPSIDE_DOWN !== 'false'
const ESC_UPSIDE_DOWN_ON = Buffer.from([0x1b, 0x7b, 0x01]) // ESC { 1

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
  let lines = [rule, `From: ${toPrintableAscii(name)}`, '', ...wrapText(idea), '', rule, '', '']
  // ESC { 1 (below) doesn't just rotate characters — it also prints lines in
  // reverse order, so the physical output reads correctly on a printer
  // mounted upside down. Left uncorrected, that meant "From: name" (sent
  // first) came out at the bottom instead of the top. Pre-reversing here
  // cancels that out so the printout reads top-to-bottom exactly like the
  // form: name, then idea.
  if (UPSIDE_DOWN) lines = [...lines].reverse()
  const parts = [ESC_INIT]
  if (UPSIDE_DOWN) parts.push(ESC_UPSIDE_DOWN_ON)
  parts.push(Buffer.from(lines.join('\n') + '\n', 'ascii'))
  fs.writeFileSync(DEVICE, Buffer.concat(parts))
}

// Cheap, non-invasive check (no bytes sent) for the public submission page
// and the dashboard health tile — just confirms the USB device node is
// present and writable, not that paper is loaded or the head is heating.
export function isPrinterConnected() {
  try {
    fs.accessSync(DEVICE, fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}
