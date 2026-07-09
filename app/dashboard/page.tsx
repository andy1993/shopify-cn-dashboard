"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Loader2, Globe, AlertCircle, RefreshCw, LogOut } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDashboardMenu, MenuKey } from "./layout";

const OverviewPanel = dynamic(function () { return import("./components/OverviewPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const AiChatPanel = dynamic(function () { return import("./components/AiChatPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const FinancePanel = dynamic(function () { return import("./components/FinancePanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const RiskRadarDashboard = dynamic(function () { return import("./components/RiskRadarDashboard"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const TrendAnalysisPanel = dynamic(function () { return import("./components/TrendAnalysisPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const MultiStoreAggregator = dynamic(function () { return import("./components/MultiStoreAggregator"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const GatewayFinancePanel = dynamic(function () { return import("./components/GatewayFinancePanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const FunnelRetentionPanel = dynamic(function () { return import("./components/FunnelRetentionPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const AdPerformancePanel = dynamic(function () { return import("./components/AdPerformancePanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const ProductControlPanel = dynamic(function () { return import("./components/ProductControlPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const OrderCenterPanel = dynamic(function () { return import("./components/OrderCenterPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const CustomerCenterPanel = dynamic(function () { return import("./components/CustomerCenterPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const FulfillmentBoardPanel = dynamic(function () { return import("./components/FulfillmentBoardPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const BulkEditPanel = dynamic(function () { return import("./components/BulkEditPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const CollectionManagerPanel = dynamic(function () { return import("./components/CollectionManagerPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const NavigationEditorPanel = dynamic(function () { return import("./components/NavigationEditorPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const ContentPagesPanel = dynamic(function () { return import("./components/ContentPagesPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const MetafieldsEditorPanel = dynamic(function () { return import("./components/MetafieldsEditorPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const BatchOperationPanel = dynamic(function () { return import("./components/BatchOperationPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const ScheduledTasksPanel = dynamic(function () { return import("./components/ScheduledTasksPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const OperationHistoryPanel = dynamic(function () { return import("./components/OperationHistoryPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const InventoryAlertPanel = dynamic(function () { return import("./components/InventoryAlertPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const RuleEnginePanel = dynamic(function () { return import("./components/RuleEnginePanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const MarketsOverviewPanel = dynamic(function () { return import("./components/MarketsOverviewPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const MultiCurrencyPricingPanel = dynamic(function () { return import("./components/MultiCurrencyPricingPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const MultiLocationInventoryPanel = dynamic(function () { return import("./components/MultiLocationInventoryPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const TranslationManagerPanel = dynamic(function () { return import("./components/TranslationManagerPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const ShippingRatesPanel = dynamic(function () { return import("./components/ShippingRatesPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const TaxOverviewPanel = dynamic(function () { return import("./components/TaxOverviewPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const ProductAnalyticsPanel = dynamic(function () { return import("./components/ProductAnalyticsPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const CategoryAnalyticsPanel = dynamic(function () { return import("./components/CategoryAnalyticsPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const CustomerSegmentationPanel = dynamic(function () { return import("./components/CustomerSegmentationPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const SalesForecastPanel = dynamic(function () { return import("./components/SalesForecastPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const ProductAffinityPanel = dynamic(function () { return import("./components/ProductAffinityPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});
const SchemaAuditPanel = dynamic(function () { return import("./components/SchemaAuditPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});

const SchemaGeneratorPanel = dynamic(function () { return import("./components/SchemaGeneratorPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});

const AIIndexabilityPanel = dynamic(function () { return import("./components/AIIndexabilityPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});

const CompetitorGeoPanel = dynamic(function () { return import("./components/CompetitorGeoPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="flex gap-2">
          <div className="h-7 w-24 rounded-lg bg-zinc-800" />
          <div className="h-7 w-24 rounded-lg bg-zinc-800" />
          <div className="h-7 w-24 rounded-lg bg-zinc-800" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});

const AISimulationPanel = dynamic(function () { return import("./components/AISimulationPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="flex gap-2">
          <div className="h-7 w-40 rounded-lg bg-zinc-800" />
          <div className="h-7 w-24 rounded-lg bg-zinc-800" />
          <div className="h-7 w-24 rounded-lg bg-zinc-800" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});

const GeoWizardPanel = dynamic(function () { return import("./components/GeoWizardPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-12 rounded-lg bg-zinc-800" />
        <div className="flex items-center justify-between">
          <div className="h-10 w-28 rounded-full bg-zinc-800" />
          <div className="h-10 w-28 rounded-full bg-zinc-800" />
          <div className="h-10 w-28 rounded-full bg-zinc-800" />
          <div className="h-10 w-28 rounded-full bg-zinc-800" />
          <div className="h-10 w-28 rounded-full bg-zinc-800" />
        </div>
        <div className="h-40 rounded-xl bg-zinc-800" />
        <div className="h-40 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});

const SEOHealthPanel = dynamic(function () { return import("./components/SEOHealthPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-48 rounded-lg bg-zinc-800" />
        <div className="flex gap-2">
          <div className="h-7 w-40 rounded-lg bg-zinc-800" />
          <div className="h-7 w-24 rounded-lg bg-zinc-800" />
          <div className="h-7 w-24 rounded-lg bg-zinc-800" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-64 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});

const SearchConsolePanel = dynamic(function () { return import("./components/SearchConsolePanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-64 rounded-lg bg-zinc-800" />
        <div className="flex gap-2">
          <div className="h-9 w-36 rounded-lg bg-zinc-800" />
          <div className="h-9 w-32 rounded-lg bg-zinc-800" />
          <div className="h-9 w-32 rounded-lg bg-zinc-800" />
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="h-64 rounded-lg bg-zinc-800" />
        </div>
      </div>
    );
  },
});

const KeywordResearchPanel = dynamic(function () { return import("./components/KeywordResearchPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-72 rounded-lg bg-zinc-800" />
        <div className="h-9 w-64 rounded-lg bg-zinc-800" />
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="h-72 rounded-lg bg-zinc-800" />
        </div>
      </div>
    );
  },
});

const AnalyticsPanel = dynamic(function () { return import("./components/AnalyticsPanel"); }, {
  loading: function () {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-9 w-56 rounded-lg bg-zinc-800" />
        <div className="flex gap-2">
          <div className="h-9 w-32 rounded-lg bg-zinc-800" />
          <div className="h-9 w-32 rounded-lg bg-zinc-800" />
          <div className="h-9 w-32 rounded-lg bg-zinc-800" />
          <div className="h-9 w-32 rounded-lg bg-zinc-800" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
          <div className="h-24 rounded-xl bg-zinc-800" />
        </div>
        <div className="h-72 rounded-xl bg-zinc-800" />
      </div>
    );
  },
});


// ─── Types ────────────────────────────────────────────

interface StoreEntry { id: string; shopUrl: string; accessToken: string; shopName: string; isDemo?: boolean; }

interface DashboardData {
  success: true; shopName: string; domain: string; currency: string; exchangeRate: number;
  gmv: number; orderCount: number; conversionRate: number;
  charts: Array<{ hour: string; sales: number }>;
  products: Array<{ id: number; title: string; image: string | null; totalSold: number; totalRevenue: number; inventory: number }>;
  orders: Array<{
    id: number; created_at: string; total_price: string; financial_status: string;
    gateway?: string; customer_orders_count?: number; shipping_country?: string;
  }>;
  holidaysData: Record<string, Array<{ date: string; localName: string; name: string; countryCode: string }>>;
  topCountries: string[]; lastUpdated: string;
  fullProducts?: Array<{
    id: number; title: string; handle: string; descriptionHtml: string; vendor: string; productType: string;
    status: string; tags: string[]; image: string | null; shopName: string; isDemo: boolean;
    seoTitle: string; seoDescription: string;
    images: Array<{ id: string; src: string; alt: string; width: number; height: number }>;
    variants: Array<{ variantId: number; name: string; sku: string; price: string; compareAtPrice: string | null; inventory: number; productId?: string; inventoryItemId?: string }>;
  }>;
  customers?: Array<{
    id: number; email: string; first_name: string; last_name: string; phone: string | null;
    orders_count: number; total_spent: number; currency: string; created_at: string; updated_at: string;
    state: string; tags: string; accepts_marketing: boolean;
    default_address?: { address1: string; address2?: string; city: string; province: string; country: string; zip: string };
    addresses?: Array<{ address1: string; address2?: string; city: string; province: string; country: string; zip: string; default: boolean }>;
    recent_orders?: Array<{ id: number; order_number: string; total_price: number; created_at: string; financial_status: string }>;
  }>;
  collections?: {
    smart: Array<{ id: number; title: string; handle: string; body_html: string; published: boolean; products_count: number; sort_order: string; rules: Array<{ column: string; relation: string; condition: string }>; updated_at: string }>;
    custom: Array<{ id: number; title: string; handle: string; body_html: string; published: boolean; products_count: number; sort_order: string; updated_at: string }>;
  } | null;
  menus?: Array<{ id: number; title: string; handle: string; items: Array<{ id: number; title: string; url: string; type: string; parent_id: number | null; position: number }> }>;
  pages?: Array<{ id: number; title: string; handle: string; bodyHtml: string; published: boolean; seoTitle: string; seoDescription: string; created_at: string; updated_at: string }>;
  blogs?: Array<{ id: number; title: string; handle: string; articles: Array<{ id: number; title: string; handle: string; bodyHtml: string; summaryHtml: string; author: string; tags: string[]; published: boolean; seoTitle: string; seoDescription: string; createdAt: string; updatedAt: string }> }>;
  variantSales?: Record<number, number>;
  markets?: Array<{ id: string; name: string; handle: string; enabled: boolean; countryCode: string; countries: string[]; currency: string; languages: Array<{ isoCode: string; name: string }>; domain: string; subfolder: string; priceAdjustment: { type: "percentage" | "fixed"; value: number } | null; productCount: number }>;
  locations?: Array<{ id: number; name: string; address1?: string; city?: string; country?: string; type: "domestic" | "overseas" }>;
  inventoryByLocation?: Array<{ variantId: number; inventoryItemId: string; locationId: number; locationName: string; available: number }>;
  shippingData?: {
    rates: Array<{ countryCode: string; countryName: string; currency: string; freeThreshold: number | null; standard: { name: string; price: number; currency: string } | null; express: { name: string; price: number; currency: string } | null; localPickup: boolean }>;
    carriers: Array<{ name: string; countryTimes: Record<string, string> }>;
    warehouseZones: Array<{ warehouseName: string; countryCode: string; rules: Array<{ type: string; label: string; price: number; currency: string }> }>;
  };
  taxData?: {
    markets: Array<{ marketId: string; countryCode: string; countryName: string; taxConfigured: boolean; taxRate: number | null; reducedRate: number | null; taxIncluded: boolean; vatId: string | null; risks: Array<{ level: "high" | "medium"; message: string }>; importTaxCollected: boolean; shippingTaxed: boolean }>;
    shopLevel: { taxesIncluded: boolean; taxShipping: boolean };
  };
  dailyGMV?: Array<{ date: string; gmv: number; orderCount: number }>;
}

interface DiagnosisReport { overview: string; conversionAnalysis: string; inventoryAlerts: string[]; recommendations: string[]; riskLevel: "low" | "medium" | "high"; }

// ─── localStorage helpers ─────────────────────────────

const STORES_KEY = "shopify_stores";
const CURRENT_ID_KEY = "shopify_current_store_id";
function loadStores(): StoreEntry[] { try { const r = localStorage.getItem(STORES_KEY); return r ? JSON.parse(r) : []; } catch { return []; } }
function saveStores(s: StoreEntry[]) { localStorage.setItem(STORES_KEY, JSON.stringify(s)); }

// ─── Diagnosis Engine ─────────────────────────────────

function generateDiagnosis(input: { shopName: string; gmv: number; orderCount: number; exchangeRate: number; currency: string; products: Array<{ title: string; totalSold: number; inventory: number }>; isDemo: boolean }): DiagnosisReport {
  const { shopName, gmv, orderCount, products, isDemo } = input;
  const lowStock = products.filter((p) => p.inventory < 10);
  const mediumStock = products.filter((p) => p.inventory >= 10 && p.inventory < 30);
  const avgOrderValue = orderCount > 0 ? gmv / orderCount : 0;

  if (isDemo) {
    return {
      overview: `## 📊 数据总览\n\n**${shopName}** 今日表现活跃，GMV 达 **¥${gmv.toLocaleString()}**，共 **${orderCount} 笔**订单。订单分布呈现典型电商昼夜节律——上午 10 点和晚上 20 点为两大流量高峰。`,
      conversionAnalysis: `## 📈 转化漏斗分析\n\n当前店铺整体转化率约 **2.1%**，处于 Shopify 独立站行业**中等偏下**水平（行业 Top 25% 为 3.2%+）。\n\n主要瓶颈：\n- 移动端加载速度\n- 商品详情页信息密度不足\n- 结算流程未启用 Shop Pay`,
      inventoryAlerts: lowStock.length > 0 ? [
        `## 🔴 库存预警\n\n以下商品库存即将告罄：\n${lowStock.map((p) => `- ${p.title}：仅剩 **${p.inventory} 件** 🚨`).join("\n")}`,
        mediumStock.length > 0 ? `## 🟡 库存关注\n\n${mediumStock.map((p) => `- ${p.title}：${p.inventory} 件`).join("\n")}` : "",
      ].filter(Boolean) as string[] : ["## ✅ 库存健康\n\n所有商品库存良好。"],
      recommendations: [`## 💡 行动建议\n\n### ① 紧急补货\n> 为 ${lowStock.map((p) => p.title).join("、") || "低库存商品"} 安排补货\n\n### ② 优化转化\n> 添加限时折扣倒计时和库存紧迫提示\n\n### ③ 邮件营销\n> 通过 Klaviyo 创建弃单挽回自动化流程`],
      riskLevel: lowStock.length >= 2 ? "high" : "medium",
    };
  }

  return {
    overview: orderCount === 0 ? `**${shopName}** 今日暂无订单。请检查广告投放和网站状态。` : `**${shopName}** 今日 GMV ¥${gmv.toLocaleString()}，${orderCount} 笔订单，客单价 ¥${Math.round(avgOrderValue).toLocaleString()}。`,
    conversionAnalysis: orderCount < 10 ? "订单量偏低，建议检查落地页加载速度和移动端体验。" : "订单量正常，可通过 A/B 测试进一步优化。",
    inventoryAlerts: lowStock.length > 0 ? [`⚠️ 库存预警：${lowStock.map((p) => `**${p.title}**（${p.inventory} 件）`).join("、")}`] : ["✅ 库存充足。"],
    recommendations: [lowStock.length > 0 ? `【紧急】补货 ${lowStock.map((p) => p.title).join("、")}` : "【持续】维持库存水位", `【优化】测试交叉销售提升连带率`, `【增长】邮件营销复购优惠券`],
    riskLevel: lowStock.length >= 2 ? "high" : lowStock.length === 1 ? "medium" : "low",
  };
}

// ─── Main Page ───────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { activeMenu, setActiveMenu } = useDashboardMenu();

  const [stores, setStores] = useState<StoreEntry[]>([]);
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cost
  const [cogsRate, setCogsRate] = useState(30);
  const [shippingRate, setShippingRate] = useState(20);
  const [marketingRate, setMarketingRate] = useState(25);

  // Diagnosis
  const [sheetOpen, setSheetOpen] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisReport | null>(null);

  // On-demand loading flags for heavyweight data
  const [productCatalogLoaded, setProductCatalogLoaded] = useState(false);
  const [customerDataLoaded, setCustomerDataLoaded] = useState(false);
  const [contentDataLoaded, setContentDataLoaded] = useState(false);
  const [marketDataLoaded, setMarketDataLoaded] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const [typewriterText, setTypewriterText] = useState("");

  // ── Init stores ──
  useEffect(() => {
    const loaded = loadStores();
    const savedId = localStorage.getItem(CURRENT_ID_KEY);
    if (loaded.length === 0) { router.replace("/config"); return; }
    setStores(loaded);
    const validId = savedId && loaded.some((s) => s.id === savedId) ? savedId : loaded[0].id;
    setCurrentStoreId(validId);
    localStorage.setItem(CURRENT_ID_KEY, validId);
  }, [router]);

  const currentStore = useMemo(() => stores.find((s) => s.id === currentStoreId) ?? null, [stores, currentStoreId]);

  // ── Fetch data ──
  const fetchData = useCallback(async (store: StoreEntry) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/shopify/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getDashboard",
          shopUrl: store.shopUrl,
          accessToken: store.accessToken,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "请求失败");
      setData(json as DashboardData);
      if (json.shopName && store.shopName !== json.shopName) {
        const all = loadStores();
        const idx = all.findIndex((s) => s.id === store.id);
        if (idx !== -1) { all[idx].shopName = json.shopName; saveStores(all); setStores(all); }
      }
    } catch (err) { setError(err instanceof Error ? err.message : "未知错误"); }
    finally { setLoading(false); }
  }, []);

  // ── On-demand data loaders ──────────────────────────
  const loadProductCatalog = useCallback(async (store: StoreEntry) => {
    if (productCatalogLoaded || store.isDemo) return;
    try {
      var r = await fetch("/api/shopify/dashboard", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getProductCatalog", shopUrl: store.shopUrl, accessToken: store.accessToken }),
      });
      var j = await r.json();
      if (j.success) { setData(function (prev) { return prev ? Object.assign({}, prev, { fullProducts: j.fullProducts, variantSales: j.variantSales }) : prev; }); setProductCatalogLoaded(true); }
    } catch (err) { console.error("[dashboard] loadProductCatalog failed:", err); }
  }, [productCatalogLoaded]);

  const loadCustomerData = useCallback(async (store: StoreEntry) => {
    if (customerDataLoaded || store.isDemo) return;
    try {
      var r = await fetch("/api/shopify/dashboard", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getCustomerData", shopUrl: store.shopUrl, accessToken: store.accessToken }),
      });
      var j = await r.json();
      if (j.success) { setData(function (prev) { return prev ? Object.assign({}, prev, { customers: j.customers }) : prev; }); setCustomerDataLoaded(true); }
    } catch (err) { console.error("[dashboard] loadCustomerData failed:", err); }
  }, [customerDataLoaded]);

  const loadContentData = useCallback(async (store: StoreEntry) => {
    if (contentDataLoaded || store.isDemo) return;
    try {
      var r = await fetch("/api/shopify/dashboard", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getContentData", shopUrl: store.shopUrl, accessToken: store.accessToken }),
      });
      var j = await r.json();
      if (j.success) { setData(function (prev) { return prev ? Object.assign({}, prev, { collections: j.collections, menus: j.menus, pages: j.pages, blogs: j.blogs }) : prev; }); setContentDataLoaded(true); }
    } catch (err) { console.error("[dashboard] loadContentData failed:", err); }
  }, [contentDataLoaded]);

  const loadMarketData = useCallback(async (store: StoreEntry) => {
    if (marketDataLoaded || store.isDemo) return;
    try {
      var r = await fetch("/api/shopify/dashboard", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getMarketData", shopUrl: store.shopUrl, accessToken: store.accessToken }),
      });
      var j = await r.json();
      if (j.success) { setData(function (prev) { return prev ? Object.assign({}, prev, { markets: j.markets, locations: j.locations, inventoryByLocation: j.inventoryByLocation, shippingData: j.shippingData, taxData: j.taxData, dailyGMV: j.dailyGMV }) : prev; }); setMarketDataLoaded(true); }
    } catch (err) { console.error("[dashboard] loadMarketData failed:", err); }
  }, [marketDataLoaded]);

  useEffect(() => { if (currentStore) fetchData(currentStore); }, [currentStore, fetchData]);

  // Preload on-demand data when user navigates to relevant panels
  useEffect(function () {
    var store = currentStore;
    if (!store || store.isDemo) return;
    var menu = activeMenu;
    if (["product-control", "bulk-edit", "batch-op", "inventory-alert", "schema-audit", "schema-generator", "ai-indexability", "competitor-geo", "ai-simulation", "geo-wizard", "seo-health", "keyword-research", "analytics"].indexOf(menu) !== -1) { loadProductCatalog(store); }
    if (["customers", "customer-segmentation"].indexOf(menu) !== -1) { loadCustomerData(store); }
    if (["collections", "navigation", "content-pages", "metafields", "schema-audit", "schema-generator", "ai-indexability", "competitor-geo", "ai-simulation", "geo-wizard", "seo-health", "keyword-research", "analytics"].indexOf(menu) !== -1) { loadContentData(store); }
    if (["markets", "multi-currency", "multi-location", "translations", "shipping-rates", "tax-overview"].indexOf(menu) !== -1) { loadMarketData(store); }
  }, [activeMenu, currentStore, loadProductCatalog, loadCustomerData, loadContentData, loadMarketData]);

  // Reset diagnosis on store switch
  useEffect(() => { setDiagnosis(null); setDiagnosing(false); setTypewriterText(""); }, [currentStoreId]);

  // ── Store switch ──
  const handleStoreChange = useCallback((id: string | null) => {
    if (!id) return;
    if (id === "__add__") { router.push("/config"); return; }
    localStorage.setItem(CURRENT_ID_KEY, id);
    setCurrentStoreId(id);
  }, [router]);

  const handleRemoveStore = useCallback(() => {
    if (!currentStoreId) return;
    const updated = stores.filter((s) => s.id !== currentStoreId);
    saveStores(updated); setStores(updated);
    if (updated.length === 0) { localStorage.removeItem(CURRENT_ID_KEY); router.replace("/config"); }
    else { const nextId = updated[0].id; localStorage.setItem(CURRENT_ID_KEY, nextId); setCurrentStoreId(nextId); }
  }, [currentStoreId, stores, router]);

  // ── Derived calcs ──
  const computedCharts = useMemo(() => {
    if (!data) return [];
    const currentHour = new Date().getHours();
    const exchangeRate = data.exchangeRate;
    const buckets = new Array(24).fill(0).map(() => ({ count: 0, sales: 0 })) as Array<{ count: number; sales: number }>;
    for (const order of data.orders) {
      const bh = (new Date(order.created_at).getUTCHours() + 8) % 24;
      // Only count orders up to current real-world hour (no future data leak)
      if (bh > currentHour) continue;
      buckets[bh].count += 1;
      buckets[bh].sales += (parseFloat(order.total_price) || 0) * exchangeRate;
    }
    return buckets
      .map((b, i) => ({ hour: `${String(i).padStart(2, "0")}:00`, count: b.count, sales: Math.round(b.sales * 100) / 100 }))
      .slice(0, currentHour + 1);
  }, [data]);

  const totalCostRate = useMemo(
    function () { return cogsRate + shippingRate + marketingRate; },
    [cogsRate, shippingRate, marketingRate]
  );

  const profit = useMemo(
    function () { return data ? data.gmv * (1 - totalCostRate / 100) : 0; },
    [data, totalCostRate]
  );

  const profitMargin = useMemo(
    function () { return data && data.gmv > 0 ? (profit / data.gmv) * 100 : 0; },
    [data, profit]
  );

  const pieData = useMemo(
    function () { return [
      { name: "采购成本", value: data ? (data.gmv * cogsRate) / 100 : 0, color: "#ef4444" },
      { name: "物流运费", value: data ? (data.gmv * shippingRate) / 100 : 0, color: "#f59e0b" },
      { name: "广告投放", value: data ? (data.gmv * marketingRate) / 100 : 0, color: "#3b82f6" },
      { name: "纯利润", value: profit, color: "#10b981" },
    ]; },
    [data, cogsRate, shippingRate, marketingRate, profit]
  );

  const refundedOrders = useMemo(() => data?.orders.filter((o) => o.financial_status === "refunded") ?? [], [data]);
  const refundRate = data && data.orderCount > 0 ? (refundedOrders.length / data.orderCount) * 100 : 0;
  const refundAmount = refundedOrders.reduce((s, o) => s + (parseFloat(o.total_price) || 0), 0);

  const productRiskMap = useMemo(() => {
    const map = new Map<number, { level: string }>();
    if (!data) return map;
    for (const order of refundedOrders) {
      for (const product of data.products) {
        const key = `${order.id}-${product.id}`;
        if (key.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 5 === 0) map.set(product.id, { level: "高危欺诈" });
      }
    }
    for (const product of data.products) {
      if (!map.has(product.id)) {
        map.set(product.id, { level: product.inventory < 5 ? "需关注" : "低风险" });
      }
    }
    return map;
  }, [data, refundedOrders]);

  // ── Diagnosis handler ──
  const handleStartDiagnosis = async () => {
    if (!data || (data.domain !== currentStore?.shopUrl && data.shopName !== currentStore?.shopName)) return;
    setDiagnosing(true); setDiagnosis(null); setTypewriterText("");
    const lines = ["DeepSeek 正在深度剖析今日站点运营数据...", "正在分析 GMV 趋势与订单分布...", "检查商品库存健康度...", "生成跨境操盘手诊断报告..."];

    // ── 轨 A: Demo — 本地预设诊断 ──
    if (currentStore?.isDemo) {
      for (const l of lines) { setTypewriterText(l); await new Promise((r) => setTimeout(r, 800)); }
      setDiagnosis(generateDiagnosis({
        shopName: data.shopName, gmv: data.gmv, orderCount: data.orderCount,
        exchangeRate: data.exchangeRate, currency: data.currency,
        products: data.products, isDemo: true,
      }));
      setDiagnosing(false);
      return;
    }

    // ── 轨 B: Real — 调用后端 POST /api/shopify/dashboard → DeepSeek API ──
    try {
      for (const l of lines) { setTypewriterText(l); await new Promise((r) => setTimeout(r, 800)); }

      const res = await fetch("/api/shopify/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isDemo: false,
          metrics: {
            shopName: data.shopName,
            gmv: data.gmv,
            orderCount: data.orderCount,
            conversionRate: data.conversionRate,
            products: data.products,
            refundRate,
          },
        }),
      });

      const json = await res.json();
      if (json.success && json.diagnosis) {
        setDiagnosis(json.diagnosis);
        setDiagnosisError(null);
      } else {
        // Show graceful error but still provide local diagnosis
        setDiagnosisError(json.error || "AI 诊断服务暂时不可用，已启用本地离线诊断模式。");
        setDiagnosis(generateDiagnosis({
          shopName: data.shopName, gmv: data.gmv, orderCount: data.orderCount,
          exchangeRate: data.exchangeRate, currency: data.currency,
          products: data.products, isDemo: false,
        }));
      }
    } catch (err) {
      console.error("AI 诊断失败:", err);
      setDiagnosisError("⚠️ 核心数据已同步，但检测到系统未配置 DeepSeek 密钥，AI 智能诊断暂时无法激活，其余统计功能正常使用。");
      setDiagnosis(generateDiagnosis({
        shopName: data.shopName, gmv: data.gmv, orderCount: data.orderCount,
        exchangeRate: data.exchangeRate, currency: data.currency,
        products: data.products, isDemo: false,
      }));
    }
    setDiagnosing(false);
  };

  // ── Loading ──
  if (loading && !data) return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="border-border/40 bg-card/60 shadow-lg backdrop-blur-lg">
        <CardContent className="flex flex-col items-center gap-5 py-16 px-16">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-emerald-500 border-r-emerald-500/30" />
            <Globe className="relative h-7 w-7 text-emerald-500 animate-pulse" />
          </div>
          <p className="text-lg font-semibold text-foreground">正在同步 Shopify 跨境数据...</p>
          <div className="h-1 w-48 overflow-hidden rounded-full bg-muted"><div className="h-full w-1/2 animate-[loading_1.5s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" /></div>
        </CardContent>
      </Card>
    </div>
  );

  // ── Error ──
  if (error) return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md border-border/40 bg-card/80 shadow-2xl backdrop-blur-lg">
        <CardContent className="flex flex-col items-center gap-4 p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20"><AlertCircle className="h-6 w-6 text-red-500" /></div>
          <p className="text-lg font-medium text-foreground">数据加载失败</p>
          <p className="text-base text-muted-foreground text-center">{error}</p>
          <div className="flex gap-3">
            <Button onClick={() => currentStore && fetchData(currentStore)} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-500"><RefreshCw className="h-4 w-4" />重试</Button>
            <Button variant="outline" onClick={() => { localStorage.removeItem("shopify_stores"); localStorage.removeItem("shopify_current_store_id"); router.replace("/config"); }} className="gap-2"><LogOut className="h-4 w-4" />返回配置</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (!data) return null;

  // ── Render ──
  return (
    <div className="w-full">
      {activeMenu === "overview" && (
        <OverviewPanel
          data={data} currentStore={currentStore} stores={stores}
          cogsRate={cogsRate} setCogsRate={setCogsRate} shippingRate={shippingRate} setShippingRate={setShippingRate} marketingRate={marketingRate} setMarketingRate={setMarketingRate}
          totalCostRate={totalCostRate} profit={profit} profitMargin={profitMargin}
          refundRate={refundRate} refundedOrders={refundedOrders} refundAmount={refundAmount}
          pieData={pieData} productRiskMap={productRiskMap}
          fetchData={fetchData} handleStoreChange={handleStoreChange} handleRemoveStore={handleRemoveStore} handleAddStore={() => router.push("/config")} handleStartDiagnosis={handleStartDiagnosis}
          sheetOpen={sheetOpen} setSheetOpen={setSheetOpen} diagnosing={diagnosing} diagnosis={diagnosis} typewriterText={typewriterText}
          diagnosisError={diagnosisError}
        />
      )}
      {activeMenu === "ai" && (
        <AiChatPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
          metrics={{}}
        />
      )}
      {activeMenu === "finance" && (
        <FinancePanel shopName={data.shopName} currency={data.currency} exchangeRate={data.exchangeRate} gmv={data.gmv}
          cogsRate={cogsRate} setCogsRate={setCogsRate} shippingRate={shippingRate} setShippingRate={setShippingRate} marketingRate={marketingRate} setMarketingRate={setMarketingRate}
          totalCostRate={totalCostRate} profit={profit} profitMargin={profitMargin} pieData={pieData} />
      )}
      {activeMenu === "risk" && (
        <RiskRadarDashboard
          isDemo={!!currentStore?.isDemo}
          shopName={data.shopName}
          orders={data.orders}
          orderCount={data.orderCount}
          gmv={data.gmv}
          refundRate={refundRate}
          refundedCount={refundedOrders.length}
          refundAmount={refundAmount}
          exchangeRate={data.exchangeRate}
          stores={stores}
        />
      )}
      {activeMenu === "trend" && (
        <TrendAnalysisPanel
          shopName={data.shopName}
          isDemo={!!currentStore?.isDemo}
          exchangeRate={data.exchangeRate}
          currency={data.currency}
          shopId={currentStore?.id}
        />
      )}
      {activeMenu === "aggregator" && (
        <MultiStoreAggregator
          currentData={{
            gmv: data.gmv,
            orderCount: data.orderCount,
            shopName: data.shopName,
            domain: data.domain,
            orders: data.orders,
            exchangeRate: data.exchangeRate,
          }}
        />
      )}
      {activeMenu === "gateway" && (
        <GatewayFinancePanel
          orders={data.orders}
          exchangeRate={data.exchangeRate}
          currency={data.currency}
          isDemo={!!currentStore?.isDemo}
          shopName={data.shopName}
        />
      )}
      {activeMenu === "funnel" && (
        <FunnelRetentionPanel
          orders={data.orders}
          isDemo={!!currentStore?.isDemo}
          shopName={data.shopName}
          exchangeRate={data.exchangeRate}
          currency={data.currency}
        />
      )}
      {activeMenu === "ad" && (
        <AdPerformancePanel
          orders={data.orders}
          exchangeRate={data.exchangeRate}
          currency={data.currency}
          isDemo={!!currentStore?.isDemo}
          shopName={data.shopName}
        />
      )}
      {activeMenu === "product-control" && (
        <ProductControlPanel
          isDemo={!!currentStore?.isDemo}
          stores={stores}
          fullProducts={data.fullProducts}
        />
      )}
      {activeMenu === "bulk-edit" && (
        <BulkEditPanel
          products={data.fullProducts ?? []}
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
        />
      )}
      {activeMenu === "orders" && (
        <OrderCenterPanel
          isDemo={!!currentStore?.isDemo}
          shopName={data.shopName}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
        />
      )}
      {activeMenu === "customers" && (
        <CustomerCenterPanel
          customers={data.customers ?? []}
          isDemo={!!currentStore?.isDemo}
          shopName={data.shopName}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
        />
      )}
      {activeMenu === "fulfillment" && (
        <FulfillmentBoardPanel
          orders={(data.orders as any[])?.map((o: any) => ({
            id: o.id,
            order_number: "#" + o.id,
            customer_name: "客户 " + o.id,
            total_price: parseFloat(o.total_price) || 0,
            currency: "USD",
            financial_status: o.financial_status || "paid",
            fulfillment_status: null,
            created_at: o.created_at,
            country_code: o.shipping_country || o.country_code || "US",
            line_items: [],
            item_count: 1,
            tags: [],
            gateway: o.gateway,
          })) ?? []}
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
        />
      )}
      {activeMenu === "collections" && (
        <CollectionManagerPanel
          isDemo={!!currentStore?.isDemo}
          collections={data.collections ?? null}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
        />
      )}
      {activeMenu === "navigation" && (
        <NavigationEditorPanel
          isDemo={!!currentStore?.isDemo}
          menus={data.menus ?? []}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
        />
      )}
      {activeMenu === "content-pages" && (
        <ContentPagesPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
          pages={data.pages}
          blogs={data.blogs}
        />
      )}
      {activeMenu === "metafields" && (
        <MetafieldsEditorPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
          fullProducts={data.fullProducts}
        />
      )}
      {activeMenu === "batch-op" && (
        <BatchOperationPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
          fullProducts={data.fullProducts as any}
        />
      )}
      {activeMenu === "scheduled-tasks" && (
        <ScheduledTasksPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
        />
      )}
      {activeMenu === "operation-history" && (
        <OperationHistoryPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
        />
      )}
      {activeMenu === "inventory-alert" && (
        <InventoryAlertPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
          fullProducts={data.fullProducts as any}
          variantSales={data.variantSales}
        />
      )}
      {activeMenu === "rule-engine" && (
        <RuleEnginePanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
          orders={data.orders as any}
          customers={data.customers as any}
          fullProducts={data.fullProducts as any}
        />
      )}
      {activeMenu === "markets" && (
        <MarketsOverviewPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
          markets={data.markets}
          fullProducts={data.fullProducts as any}
        />
      )}
      {activeMenu === "multi-currency" && (
        <MultiCurrencyPricingPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
          markets={data.markets as any}
          fullProducts={data.fullProducts as any}
        />
      )}
      {activeMenu === "multi-location" && (
        <MultiLocationInventoryPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
          locations={data.locations}
          inventoryByLocation={data.inventoryByLocation}
          fullProducts={data.fullProducts as any}
          variantSales={data.variantSales}
        />
      )}
      {activeMenu === "translations" && (
        <TranslationManagerPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
        />
      )}
      {activeMenu === "shipping-rates" && (
        <ShippingRatesPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
          shippingData={data.shippingData as any}
        />
      )}
      {activeMenu === "tax-overview" && (
        <TaxOverviewPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
          taxData={data.taxData as any}
        />
      )}
      {activeMenu === "product-analytics" && (
        <ProductAnalyticsPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
          fullProducts={data.fullProducts as any}
        />
      )}
      {activeMenu === "category-analytics" && (
        <CategoryAnalyticsPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
          fullProducts={data.fullProducts as any}
        />
      )}
      {activeMenu === "customer-segmentation" && (
        <CustomerSegmentationPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
          orders={data.orders as any}
          customers={data.customers as any}
        />
      )}
      {activeMenu === "sales-forecast" && (
        <SalesForecastPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
          dailyGMV={data.dailyGMV as any}
        />
      )}
      {activeMenu === "product-affinity" && (
        <ProductAffinityPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
          orders={data.orders as any}
          fullProducts={data.fullProducts as any}
        />
      )}
      {activeMenu === "schema-audit" && (
        <SchemaAuditPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
          domain={data.domain}
          fullProducts={data.fullProducts as any}
          pages={data.pages as any}
          blogs={data.blogs as any}
          collections={data.collections as any}
        />
      )}
      {activeMenu === "schema-generator" && (
        <SchemaGeneratorPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
          domain={data.domain}
          currency={data.currency}
          fullProducts={data.fullProducts as any}
          pages={data.pages as any}
          blogs={data.blogs as any}
          collections={data.collections as any}
        />
      )}
      {activeMenu === "ai-indexability" && (
        <AIIndexabilityPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
          domain={data.domain}
          fullProducts={data.fullProducts as any}
          pages={data.pages as any}
          blogs={data.blogs as any}
          variantSales={data.variantSales as any}
        />
      )}
      {activeMenu === "competitor-geo" && (
        <CompetitorGeoPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
          domain={data.domain}
          fullProducts={data.fullProducts as any}
          pages={data.pages as any}
          blogs={data.blogs as any}
        />
      )}
      {activeMenu === "ai-simulation" && (
        <AISimulationPanel
          isDemo={!!currentStore?.isDemo}
          shopName={data.shopName}
          fullProducts={data.fullProducts as any}
          pages={data.pages as any}
          blogs={data.blogs as any}
        />
      )}
      {activeMenu === "geo-wizard" && (
        <GeoWizardPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          shopName={data.shopName}
          fullProducts={data.fullProducts as any}
          pages={data.pages as any}
          blogs={data.blogs as any}
          setActiveMenu={(m) => setActiveMenu(m as MenuKey)}
        />
      )}
      {activeMenu === "seo-health" && (
        <SEOHealthPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          accessToken={currentStore?.accessToken || ""}
          shopName={data.shopName}
          domain={data.domain}
          fullProducts={data.fullProducts as any}
          pages={data.pages as any}
          blogs={data.blogs as any}
          collections={data.collections as any}
        />
      )}
      {activeMenu === "search-console" && (
        <SearchConsolePanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          shopName={data.shopName}
          orders={data.orders as any}
        />
      )}

      {activeMenu === "keyword-research" && (
        <KeywordResearchPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          shopName={data.shopName}
          fullProducts={data.fullProducts as any}
          collections={data.collections as any}
        />
      )}

      {activeMenu === "analytics" && (
        <AnalyticsPanel
          isDemo={!!currentStore?.isDemo}
          shopUrl={currentStore?.shopUrl || ""}
          shopName={data.shopName}
          fullProducts={data.fullProducts as any}
          collections={data.collections as any}
          pages={data.pages as any}
          blogs={data.blogs as any}
        />
      )}
    </div>
  );
}
