package resource

import (
	"context"
	"testing"
)

func TestSegmentDataStore(t *testing.T) {
	t.Skip("segment datastore methods not yet implemented")

	tests := []struct {
		name string
		fn   func(*testing.T, context.Context, DataStore)
	}{
		{"Save_And_Get", testDataStoreSaveAndGet},
		{"Delete", testDataStoreDelete},
		{"List", testDataStoreList},
		{"Keys", testDataStoreKeys},
		{"LastResourceVersion", testDataStoreLastResourceVersion},
		{"GetLatestResourceKey", testDataStoreGetLatestResourceKey},
		{"GetLatestResourceKey_Deleted", testDataStoreGetLatestResourceKeyDeleted},
		{"GetLatestResourceKey_NotFound", testDataStoreGetLatestResourceKeyNotFound},
		{"GetResourceKeyAtRevision", testDataStoreGetResourceKeyAtRevision},
		{"ListLatestResourceKeys", testDataStoreListLatestResourceKeys},
		{"ListLatestResourceKeys_Deleted", testDataStoreListLatestResourceKeysDeleted},
		{"ListLatestResourceKeys_Multiple", testDataStoreListLatestResourceKeysMultiple},
		{"ListResourceKeysAtRevision", testDataStoreListResourceKeysAtRevision},
		{"ListResourceKeysAtRevision_EmptyResults", testDataStoreListResourceKeysAtRevisionEmptyResults},
		{"ListResourceKeysAtRevision_ResourcesNewerThanRevision", testDataStoreListResourceKeysAtRevisionResourcesNewerThanRevision},
		{"GetResourceStats_Comprehensive", testDataStoreGetResourceStatsComprehensive},
		{"GetLatestAndPredecessor", testDataStoreGetLatestAndPredecessor},
		{"BatchGet", testDataStoreBatchGet},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ds := setupTestSegmentDataStore(t)
			tt.fn(t, t.Context(), ds)
		})
	}
}
