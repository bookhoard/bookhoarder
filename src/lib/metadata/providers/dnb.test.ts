import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchDnb } from "./dnb";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function textResponse(body: string, ok = true) {
  return { ok, text: async () => body } as Response;
}

function sruResponse(records: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<searchRetrieveResponse xmlns="http://www.loc.gov/zing/srw/">
  <version>1.1</version>
  <numberOfRecords>1</numberOfRecords>
  <records>${records}</records>
</searchRetrieveResponse>`;
}

function marcRecord(datafields: string) {
  return `<record><recordSchema>MARC21-xml</recordSchema><recordData><record xmlns="http://www.loc.gov/MARC21/slim">${datafields}</record></recordData></record>`;
}

describe("searchDnb", () => {
  it("parses title, author, language, and derives a cover URL from the ISBN", async () => {
    const xml = sruResponse(
      marcRecord(`
        <datafield tag="020" ind1=" " ind2=" "><subfield code="a">9783755300274</subfield></datafield>
        <datafield tag="041" ind1=" " ind2=" "><subfield code="a">ger</subfield></datafield>
        <datafield tag="100" ind1="1" ind2=" "><subfield code="a">Goethe, Johann Wolfgang von</subfield></datafield>
        <datafield tag="245" ind1="1" ind2="0"><subfield code="a">Faust</subfield><subfield code="b">Illustrierte Ausgabe</subfield></datafield>
      `)
    );
    fetchMock.mockResolvedValue(textResponse(xml));

    const [candidate] = await searchDnb({ title: "Faust", author: "Goethe" });
    expect(candidate).toEqual({
      title: "Faust: Illustrierte Ausgabe",
      authors: ["Goethe, Johann Wolfgang von"],
      language: "ger",
      coverUrl: "https://portal.dnb.de/opac/mvb/cover?isbn=9783755300274",
      source: "dnb",
      sourceLabel: "Deutsche Nationalbibliothek",
    });
  });

  it("skips records with no 245 title field", async () => {
    const xml = sruResponse(marcRecord(`<datafield tag="100" ind1="1" ind2=" "><subfield code="a">Someone</subfield></datafield>`));
    fetchMock.mockResolvedValue(textResponse(xml));
    expect(await searchDnb({ title: "Faust", author: "Goethe" })).toEqual([]);
  });

  it("omits the cover URL when there's no ISBN", async () => {
    const xml = sruResponse(marcRecord(`<datafield tag="245" ind1="1" ind2="0"><subfield code="a">Faust</subfield></datafield>`));
    fetchMock.mockResolvedValue(textResponse(xml));
    const [candidate] = await searchDnb({ title: "Faust", author: "Goethe" });
    expect(candidate.coverUrl).toBeUndefined();
  });

  it("returns an empty list on a non-ok response", async () => {
    fetchMock.mockResolvedValue(textResponse("", false));
    expect(await searchDnb({ title: "Faust", author: "Goethe" })).toEqual([]);
  });

  it("returns an empty list when there are zero records", async () => {
    fetchMock.mockResolvedValue(
      textResponse(`<?xml version="1.0"?><searchRetrieveResponse xmlns="http://www.loc.gov/zing/srw/"><numberOfRecords>0</numberOfRecords></searchRetrieveResponse>`)
    );
    expect(await searchDnb({ title: "Nonexistent", author: "Nobody" })).toEqual([]);
  });
});
