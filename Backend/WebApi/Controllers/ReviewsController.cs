using Application.Interfaces.Repositories;
using AutoMapper;
using Domain.Entities;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApi.ApiDtos;
using WebApi.ApiDtos.Listings;
using WebApi.ApiDtos.Reviews;
using WebApi.Services;

namespace WebApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ReviewsController : AuthorizedControllerBase
    {
        private readonly IReviewRepository reviewRepository;
        private readonly IMapper mapper;
        private readonly UserManager<ApplicationUser> userManager;
        private readonly ISystemUserProvider systemUserProvider;

        public ReviewsController(
            IReviewRepository reviewRepository,
            IMapper mapper,
            UserManager<ApplicationUser> userManager,
            ISystemUserProvider systemUserProvider)
        {
            this.reviewRepository = reviewRepository;
            this.mapper = mapper;
            this.userManager = userManager;
            this.systemUserProvider = systemUserProvider;
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Create([FromBody] CreateReviewRequest request)
        {
            if (!TryGetAuthenticatedUserId(out var userId))
                return Unauthorized();

            if (request.RevieweeId == userId)
                return BadRequest("Нельзя оставить отзыв самому себе.");

            var systemUser = await systemUserProvider.GetSystemUserAsync();
            if (request.RevieweeId == systemUser.Id)
                return BadRequest("Нельзя оставить отзыв системному пользователю.");

            var reviewee = await userManager.FindByIdAsync(request.RevieweeId.ToString());
            if (reviewee == null)
                return NotFound("Получатель отзыва не найден.");

            var domain = mapper.Map<Review>(request);
            domain.ReviewerId = userId;
            domain.CreatedAt = DateTime.Now;

            var created = await reviewRepository.CreateAsync(domain);
            if (created == null)
                return BadRequest("Unable to create review.");

            var dto = mapper.Map<ReviewDto>(created);
            dto.Reviewer = mapper.Map<UserDto>(await userManager.FindByIdAsync(userId.ToString()));
            return Ok(dto);
        }

        [HttpGet("byReviewee/{revieweeId}")]
        public async Task<IActionResult> GetByReviewee(Guid revieweeId, int pageNumber = 1, int pageSize = 20)
        {
            var page = await reviewRepository
                           .GetAllByRevieweeAsync(revieweeId, pageNumber, pageSize);
            var reviews = page.Items;

            var reviewerIds = reviews.Select(r => r.ReviewerId).Distinct().ToList();
            var users = await userManager.Users
                .Where(u => reviewerIds.Contains(u.Id))
                .ToListAsync();
            var userDtoMap = users
                .Select(u => mapper.Map<UserDto>(u))
                .ToDictionary(u => u.Id);

            var dtos = reviews.Select(r =>
            {
                var dto = mapper.Map<ReviewDto>(r);
                dto.Reviewer = userDtoMap.TryGetValue(r.ReviewerId, out var reviewerDto)
                    ? reviewerDto
                    : new UserDto { Id = r.ReviewerId, Nickname = "Удалённый пользователь" };
                return dto;
            }).ToList();

            return Ok(new PageDto<ReviewDto>
            {
                Items = dtos,
                TotalPages = page.TotalPages,
                PageNumber = pageNumber,
                PageSize = pageSize
            });
        }

        [HttpDelete("{id:Guid}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var domain = await reviewRepository.DeleteAsync(id);
            if (domain == null)
                return NotFound();

            return Ok();
        }
    }
}
