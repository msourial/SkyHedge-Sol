import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgriculturalMarket } from "./api.ts";
import { mapTilerStyleUrl, openStreetMapUrl, referenceEvidenceLabel, referenceLocationFor, referencePointFor } from "./reference-map.ts";

const desMoines: AgriculturalMarket = {
  slug: "des-moines", name: "Des Moines crop belt", locality: "Des Moines", region: "North America",
  country: "United States", administrativeArea: "Iowa", latitude: 41.59, longitude: -93.62,
  crops: ["corn"], agriculturalContext: "Crop rainfall", evidenceStatus: "researching_evidence", noaaStationId: null,
};

describe("native reference map", () => {
  it("uses only catalog reference coordinates and exact location text", () => {
    assert.deepEqual(referencePointFor(desMoines), { slug: "des-moines", location: "Des Moines, Iowa, United States", latitude: 41.59, longitude: -93.62, zoom: 10 });
    assert.equal(referencePointFor(undefined), null);
    assert.equal(referencePointFor({ ...desMoines, latitude: 999 }), null);
  });

  it("keeps the place journey usable when the catalog API is unavailable", () => {
    assert.equal(referenceLocationFor("des-moines", undefined), "Des Moines, Iowa, United States");
    assert.equal(referenceLocationFor("toronto", undefined), "Toronto, Ontario, Canada");
    assert.equal(referenceLocationFor("saskatoon", undefined), "Saskatoon, Saskatchewan, Canada");
    assert.equal(referenceLocationFor("unverified-area", undefined), null);
    assert.equal(referencePointFor(undefined), null);
  });

  it("never carries rainfall validation into wind or snowfall", () => {
    assert.equal(referenceEvidenceLabel("rainfall", true), "NOAA rainfall station package validated");
    assert.equal(referenceEvidenceLabel("wind-gust", true), "Researching NOAA wind-gust evidence");
    assert.equal(referenceEvidenceLabel("snowfall", true), "Researching NOAA snowfall evidence");
    assert.equal(referenceEvidenceLabel(null, true), "Choose a risk to review NOAA evidence");
  });

  it("does not request tiles without a configured key", () => {
    assert.equal(mapTilerStyleUrl(undefined), null);
    assert.equal(mapTilerStyleUrl(" "), null);
    assert.match(mapTilerStyleUrl("test-key") ?? "", /dataviz-v4-dark\/style\.json\?key=test-key/);
  });

  it("opens an attributed larger reference map for a valid point", () => {
    assert.match(openStreetMapUrl(referencePointFor(desMoines)!), /mlat=41\.59000&mlon=-93\.62000/);
  });
});
