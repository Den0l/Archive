using System;
using Infrastructure.Persistence.Contexts;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    [DbContext(typeof(MarketplaceDbContext))]
    [Migration("20260406130000_AddNormalizedNickname")]
    public partial class AddNormalizedNickname : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "NormalizedNickname",
                table: "AspNetUsers",
                type: "varchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.Sql(@"
UPDATE AspNetUsers
SET NormalizedNickname = UPPER(TRIM(Nickname))
WHERE NormalizedNickname IS NULL AND Nickname IS NOT NULL;
");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_NormalizedNickname",
                table: "AspNetUsers",
                column: "NormalizedNickname",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_NormalizedNickname",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "NormalizedNickname",
                table: "AspNetUsers");
        }
    }
}
