const fs = require('fs').promises;
const path = require('path');
const searchRecursively = require('./search-recursively');

/**
 * Groups results by search pattern
 * @param {Array} allResults - Array of all search results
 * @param {Array} patterns - Array of search patterns
 * @returns {Object} Results grouped by search pattern
 */
function groupResultsByPattern(allResults, patterns) {
    const groupedResults = new Map();

    patterns.forEach(pattern => {
        const searchTerm = typeof pattern === 'string' ? pattern : pattern.include;
        groupedResults.set(searchTerm, new Set());
    });

    allResults.forEach(result => {
        const content = result.lines.map(line => line.content).join('\n');
        
        patterns.forEach(pattern => {
            const searchTerm = typeof pattern === 'string' ? pattern : pattern.include;
            const searchRegex = new RegExp(
                pattern.wholeWord ? `\\b${searchTerm}\\b` : searchTerm,
                pattern.caseSensitive ? 'g' : 'gi'
            );

            if (searchRegex.test(content)) {
                const excludeTerms = pattern.exclude || [];
                const hasExclusion = excludeTerms.some(excludeTerm => {
                    const excludeRegex = new RegExp(
                        pattern.wholeWord ? `\\b${excludeTerm}\\b` : excludeTerm,
                        pattern.caseSensitive ? 'g' : 'gi'
                    );
                    return excludeRegex.test(content);
                });

                if (!hasExclusion) {
                    groupedResults.get(searchTerm).add(result.fileName);
                }
            }
        });
    });

    return groupedResults;
}

/**
 * Formats the search results into a simple grouped format
 * @param {Map} groupedResults - Results grouped by search pattern
 * @returns {string} Formatted results
 */
function formatSimpleResults(groupedResults) {
    const lines = [];
    
    groupedResults.forEach((files, searchTerm) => {
        lines.push(searchTerm);
        [...files].sort().forEach(file => {
            lines.push(file);
        });
        lines.push(''); // Empty line between groups
    });

    return lines.join('\n');
}

/**
 * Main search function that combines multiple searches and writes results to file
 * @param {Object} config - Search configuration
 * @param {string[]} config.directories - Directories to search in
 * @param {Array} config.patterns - Search patterns
 * @param {string[]} config.fileTypes - File types to include
 * @param {string[]} config.excludeDirs - Directories to exclude
 * @param {string} config.folder - Output folder path
 * @param {string} config.fileName - Base name for the output file (without extension)
 * @param {number} timestamp - Timestamp to be used in the filename
 * @param {boolean} config.verbose - Whether to log verbose information
 * @returns {Promise<string>} Path to the results file
 */
async function performSearch({
    directories = [],
    patterns = [],
    fileTypes = [],
    excludeDirs = ['node_modules', '.git'],
    folder = './search-results',
    fileName = 'search-results',
    verbose = false
}, timestamp = Date.now()) {
    try {
        // Create the full folder path if it doesn't exist
        await fs.mkdir(folder, { recursive: true });

        // Perform all searches
        const allResults = [];
        for (const dir of directories) {
            for (const pattern of patterns) {
                const results = searchRecursively(dir, pattern, {
                    excludeDirs,
                    includeFiles: fileTypes,
                    verbose
                });
                allResults.push(...results);
            }
        }

        // Group results by search pattern
        const groupedResults = groupResultsByPattern(allResults, patterns);

        // Format results
        const formattedResults = formatSimpleResults(groupedResults);

        // Create the full file path
        const fullFileName = `${fileName}-${timestamp}.txt`;
        const filePath = path.join(folder, fullFileName);
        
        // Write results to file
        await fs.writeFile(filePath, formattedResults, 'utf8');
        
        if (verbose) {
            console.log(`Results written to: ${filePath}`);
        }
        
        return filePath;
    } catch (error) {
        console.error('Error in performSearch:', error);
        throw error; // Re-throw to allow caller to handle the error
    }
}

// Example usage
async function main() {
    try {
        const timestamp = Date.now();
        const resultFile = await performSearch({
            directories: ['../some-folder'],
            patterns: [
                {
                    include: 'phrase1',
                    exclude: ['phrase1NotThis'],
                    caseSensitive: false,
                    wholeWord: true
                },
                {
                    include: 'shrase2',
                    caseSensitive: true,
                    wholeWord: true
                }
            ],
            fileTypes: ['.js', '.vue'],
            excludeDirs: ['node_modules', 'dist', '*cache'],
            folder: './reports/code-search',
            fileName: 'search-results',
            verbose: true
        }, timestamp);
        
        console.log(`Search completed: ${resultFile}`);
    } catch (error) {
        console.error('Error performing search:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = performSearch;
