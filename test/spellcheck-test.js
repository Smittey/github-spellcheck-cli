const chai = require('chai')
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
chai.should();

const _ = require('lodash');
const mockery = require('mockery');

describe('getMisspellings', () => {
  before(() => {
    mockery.registerAllowables(['fs', 'lodash', 'path', '../lib/spellcheck']);
    mockery.enable({ useCleanCache: true, warnOnUnregistered: false });
  });
  after(() => mockery.disable());

  function buildIndicesFromWords(document, words) {
    return _.map(words, word => {
      const start = document.indexOf(word);
      return {
        start,
        end: start + word.length,
      };
    });
  }

  function mockSpellchecker(indices, corrections) {
    mockery.deregisterMock('spellchecker');
    mockery.resetCache();
    mockery.registerMock('spellchecker', {
      checkSpellingAsync: _.constant(Promise.resolve(indices)),
      getCorrectionsForMisspelling: misspelling => corrections[misspelling],
    });
    return require('../lib/spellcheck');
  }

  function testSpellcheck({ document, misspellings, corrections, expectedMisspellings, fileName }) {
    const indices = buildIndicesFromWords(document, misspellings);
    const { getMisspellings } = mockSpellchecker(indices, corrections);
    return getMisspellings(document, fileName).should.eventually.deep.equal(
      _.map(expectedMisspellings, index => ({
        index: indices[index],
        misspelling: misspellings[index],
        suggestions: corrections[misspellings[index]],
      }))
    );
  }

  it('should return an empty array given a sentence with no misspellings', () => {
    return testSpellcheck({
      document: 'Test sentence',
      misspellings: [],
      corrections: [],
      expectedMisspellings: [],
      fileName: 'test.txt',
    });
  });

  it('should return a single misspelling given a sentence with one misspelling', () => {
    return testSpellcheck({
      document: 'Test sentenc',
      misspellings: ['sentenc'],
      corrections: { sentenc: ['sentence'] },
      expectedMisspellings: [0],
      fileName: 'test.txt'
    });
  });

  it('should skip lines between triple backticks in a Markdown file', () => {
    return testSpellcheck({
      document: '```\ntset\n```',
      misspellings: ['tset'],
      corrections: { tset: ['test'] },
      expectedMisspellings: [],
      fileName: 'test.md',
    });
  });

  it('should skip code blocks specified with four-space indent in a Markdown file', () => {
    return testSpellcheck({
      document: '# Heading\n\n    tset\n\ntest',
      misspellings: ['tset'],
      corrections: { tset: ['test'] },
      expectedMisspellings: [],
      fileName: 'test.md',
    });
  });

  it('should skip inline code blocks in a Markdown file', () => {
    return testSpellcheck({
      document: '`tset`',
      misspellings: ['tset'],
      corrections: { tset: ['test'] },
      expectedMisspellings: [],
      fileName: 'test.md',
    });
  });

  it('should spellcheck lines between triple backticks in a text file', () => {
    return testSpellcheck({
      document: '```\ntset\n```',
      misspellings: ['tset'],
      corrections: { tset: ['test'] },
      expectedMisspellings: [0],
      fileName: 'test.txt',
    });
  });

  it('should skip Markdown link URLs but not link text', () => {
    return testSpellcheck({
      document: '[My awesoem project](/github)',
      misspellings: ['awesoem', 'github'],
      corrections: {
        awesoem: ['awesome'],
        github: ['gilt'],
      },
      expectedMisspellings: [0],
      fileName: 'test.md',
    });
  });

  it('should skip Markdown image URLs but not alt text', () => {
    return testSpellcheck({
      document: '![Alt text with errror](/my-awesome-image.png)',
      misspellings: ['errror', 'png'],
      corrections: {
        errror: ['error'],
        png: ['pang'],
      },
      expectedMisspellings: [0],
      fileName: 'test.md',
    });
  });

  it('should handle a Markdown image in a link', () => {
    return testSpellcheck({
      document: '[![Alt text with errror](/my-awesome-image.png)](/github)',
      misspellings: ['errror', 'png', 'github'],
      corrections: {
        errror: ['error'],
        png: ['pang'],
        github: ['gilt'],
      },
      expectedMisspellings: [0],
      fileName: 'test.md',
    });
  });

  it('should handle an HTML img tag in a Markdown file', () => {
    return testSpellcheck({
      document: '# Heading\n\n<img src="/test.png">',
      misspellings: ['img', 'src'],
      corrections: {
        img: ['image'],
        src: ['sec'],
      },
      expectedMisspellings: [],
      fileName: 'test.md',
    });
  });

  it('should handle an HTML table in a Markdown file', () => {
    return testSpellcheck({
      document: `
# Heading

<table>
  <th>
    <td>Colunm 1</td>
    <td>Column 2</td>
  </th>
  <tr>
    <td>Test</td>
    <td>Test 2</td>
  </tr>
  <tr>
    <td colspan="2">Wiide column</td>
  </tr>
</table>
      `,
      misspellings: ['th', 'td', 'Colunm', 'tr', 'colspan', 'Wiide'],
      corrections: {},
      expectedMisspellings: [2, 5],
      fileName: 'test.md',
    });
  });
});