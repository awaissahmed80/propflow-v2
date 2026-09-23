<?php

use App\Models\Lead;
use App\Models\Order;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table): void {
            if (! Schema::hasColumn('tasks', 'taskable_type')) {
                $table->string('taskable_type')->nullable()->after('user_id');
            }

            if (! Schema::hasColumn('tasks', 'taskable_id')) {
                $table->unsignedBigInteger('taskable_id')->nullable()->after('taskable_type');
            }
        });

        if (! $this->indexExists('tasks', 'tasks_taskable_created_index')) {
            Schema::table('tasks', function (Blueprint $table): void {
                $table->index(['taskable_type', 'taskable_id', 'created_at'], 'tasks_taskable_created_index');
            });
        }

        if (Schema::hasColumn('tasks', 'order_id')) {
            DB::table('tasks')
                ->whereNotNull('order_id')
                ->whereNull('taskable_id')
                ->orderBy('id')
                ->chunkById(200, function ($rows): void {
                    foreach ($rows as $row) {
                        DB::table('tasks')->where('id', $row->id)->update([
                            'taskable_type' => Order::class,
                            'taskable_id' => $row->order_id,
                        ]);
                    }
                });
        }

        if (Schema::hasColumn('tasks', 'lead_id')) {
            DB::table('tasks')
                ->whereNull('order_id')
                ->whereNotNull('lead_id')
                ->whereNull('taskable_id')
                ->orderBy('id')
                ->chunkById(200, function ($rows): void {
                    foreach ($rows as $row) {
                        DB::table('tasks')->where('id', $row->id)->update([
                            'taskable_type' => Lead::class,
                            'taskable_id' => $row->lead_id,
                        ]);
                    }
                });
        }

        Schema::table('tasks', function (Blueprint $table): void {
            if (Schema::hasColumn('tasks', 'order_id')) {
                $this->dropForeignKeyIfExists($table, 'tasks', 'order_id');
            }

            if (Schema::hasColumn('tasks', 'lead_id')) {
                $this->dropForeignKeyIfExists($table, 'tasks', 'lead_id');
            }
        });

        $this->dropIndexesReferencing('tasks', ['order_id', 'lead_id']);

        Schema::table('tasks', function (Blueprint $table): void {
            if (Schema::hasColumn('tasks', 'order_id')) {
                $table->dropColumn('order_id');
            }

            if (Schema::hasColumn('tasks', 'lead_id')) {
                $table->dropColumn('lead_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table): void {
            if (! Schema::hasColumn('tasks', 'lead_id')) {
                $table->foreignId('lead_id')->nullable()->after('user_id')->constrained('leads')->cascadeOnDelete();
            }

            if (! Schema::hasColumn('tasks', 'order_id')) {
                $table->foreignId('order_id')->nullable()->after('lead_id')->constrained('orders')->nullOnDelete();
                $table->index(['order_id', 'created_at']);
            }
        });

        DB::table('tasks')
            ->where('taskable_type', Order::class)
            ->orderBy('id')
            ->chunkById(200, function ($rows): void {
                foreach ($rows as $row) {
                    $leadId = DB::table('orders')->where('id', $row->taskable_id)->value('lead_id');

                    DB::table('tasks')->where('id', $row->id)->update([
                        'order_id' => $row->taskable_id,
                        'lead_id' => $leadId,
                    ]);
                }
            });

        DB::table('tasks')
            ->where('taskable_type', Lead::class)
            ->orderBy('id')
            ->chunkById(200, function ($rows): void {
                foreach ($rows as $row) {
                    DB::table('tasks')->where('id', $row->id)->update([
                        'lead_id' => $row->taskable_id,
                        'order_id' => null,
                    ]);
                }
            });

        Schema::table('tasks', function (Blueprint $table): void {
            if ($this->indexExists('tasks', 'tasks_taskable_created_index')) {
                $table->dropIndex('tasks_taskable_created_index');
            }

            if (Schema::hasColumn('tasks', 'taskable_type')) {
                $table->dropColumn(['taskable_type', 'taskable_id']);
            }
        });
    }

    protected function indexExists(string $table, string $index): bool
    {
        foreach (Schema::getIndexes($table) as $row) {
            if (($row['name'] ?? null) === $index) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  list<string>  $columns
     */
    protected function dropIndexesReferencing(string $table, array $columns): void
    {
        foreach (Schema::getIndexes($table) as $index) {
            $name = $index['name'] ?? null;
            $indexColumns = $index['columns'] ?? [];

            if (! is_string($name) || $name === 'primary') {
                continue;
            }

            if (array_intersect($columns, $indexColumns) === []) {
                continue;
            }

            Schema::table($table, function (Blueprint $blueprint) use ($name): void {
                $blueprint->dropIndex($name);
            });
        }
    }

    protected function dropForeignKeyIfExists(Blueprint $table, string $tableName, string $column): void
    {
        foreach (Schema::getForeignKeys($tableName) as $foreignKey) {
            $columns = $foreignKey['columns'] ?? [];

            if (! in_array($column, $columns, true)) {
                continue;
            }

            $name = $foreignKey['name'] ?? null;
            $table->dropForeign(is_string($name) && $name !== '' ? $name : [$column]);

            return;
        }
    }
};
