/**
 * Utility functions for DAG route handlers
 */

/**
 * Extracts and parses JSON content from a markdown code block.
 * @param response - The markdown string containing a JSON code block
 * @returns The parsed JSON object
 * @throws Error if no JSON code block is found or parsing fails
 */
export function extractJsonCodeBlock(response: string): unknown {
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch || !jsonMatch[1]) {
    throw new Error('No JSON code block found in response');
  }
  return JSON.parse(jsonMatch[1].trim());
}

/**
 * Extracts and parses JSON content from a markdown code block with detailed diagnostics.
 * Provides specific error locations and context for large JSON objects.
 * @param response - The markdown string containing a JSON code block
 * @returns The parsed JSON object
 * @throws Error with detailed diagnostics if extraction or parsing fails
 */
export function extractCodeBlock(response: string): unknown {
  // Try to find ```json code block
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch || !jsonMatch[1]) {
    // Fallback: try to find any ``` code block
    const anyMatch = response.match(/```\s*([\s\S]*?)\s*```/);
    if (!anyMatch || !anyMatch[1]) {
      throw new Error('No JSON code block found in response');
    }
  }

  const jsonContent = (jsonMatch?.[1] || response).trim();

  // Attempt to parse JSON
  try {
    return JSON.parse(jsonContent);
  } catch (parseError) {
    // Provide detailed diagnostics
    const error = parseError as SyntaxError;
    const errorMessage = error.message;

    // Try to extract line and position info from error message
    const positionMatch = errorMessage.match(/position (\d+)/);
    const position = positionMatch ? parseInt(positionMatch[1], 10) : null;

    // Find line number from position
    let lineNumber = 1;
    let columnNumber = 1;
    let currentPos = 0;

    if (position !== null) {
      const lines = jsonContent.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const lineLength = lines[i].length + 1; // +1 for newline
        if (currentPos + lineLength > position) {
          lineNumber = i + 1;
          columnNumber = position - currentPos + 1;
          break;
        }
        currentPos += lineLength;
      }
    }

    // Extract context around error
    const lines = jsonContent.split('\n');
    const contextStart = Math.max(0, lineNumber - 3);
    const contextEnd = Math.min(lines.length, lineNumber + 2);
    const context = lines
      .slice(contextStart, contextEnd)
      .map((line, idx) => {
        const actualLineNum = contextStart + idx + 1;
        const marker = actualLineNum === lineNumber ? '>>> ' : '    ';
        return `${marker}${String(actualLineNum).padStart(4, ' ')}: ${line}`;
      })
      .join('\n');

    const diagnosticMessage = [
      `JSON Parse Error: ${errorMessage}`,
      `Location: Line ${lineNumber}, Column ${columnNumber}`,
      `Content Preview (lines ${contextStart + 1}-${contextEnd}):`,
      context,
      `Total size: ${jsonContent.length} characters, ${lines.length} lines`,
    ].join('\n');

    throw new Error(diagnosticMessage);
  }
}

/**
 * Truncates a string to a specified length.
 * @param str - The string to truncate
 * @param numChars - Maximum number of characters (default: 2000)
 * @returns The truncated string
 */
export function truncate(str: string, numChars = 2000): string {
  if (str.length <= numChars) return str;
  return str.slice(0, numChars);
}

/**
 * Truncates goal text for logging purposes.
 * @param goalText - The goal text to truncate
 * @returns Truncated text with ellipsis if needed
 */
export function truncateForLog(goalText: string): string {
  return goalText.length > 50 ? `${goalText.slice(0, 50)}...` : goalText;
}

/**
 * Parses a date string or relative date expression.
 * @param dateStr - Date string (ISO format or relative like "7d", "2w", "1m")
 * @param defaultDate - Default date to use if dateStr is undefined
 * @returns Parsed Date object
 */
export function parseDate(dateStr: string | undefined, defaultDate: Date): Date {
  if (!dateStr) return defaultDate;
  
  // Handle relative dates like "7d" or "2w"
  const relativeMatch = dateStr.match(/^(\d+)([dwm])$/);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];
    const now = new Date();
    switch (unit) {
      case 'd': return new Date(now.getTime() - amount * 24 * 60 * 60 * 1000);
      case 'w': return new Date(now.getTime() - amount * 7 * 24 * 60 * 60 * 1000);
      case 'm': return new Date(now.getFullYear(), now.getMonth() - amount, now.getDate());
    }
  }
  
  return new Date(dateStr);
}

/**
 * Formats a date according to the specified grouping.
 * @param date - The date to format
 * @param groupBy - Grouping type ('day', 'week', 'month')
 * @returns Formatted date string
 */
export function formatDateByGroup(date: Date, groupBy: 'day' | 'week' | 'month'): string {
  switch (groupBy) {
    case 'week': {
      const d = new Date(date);
      d.setDate(d.getDate() - d.getDay()); // Start of week
      return d.toISOString().split('T')[0];
    }
    case 'month':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    default:
      return date.toISOString().split('T')[0];
  }
}
